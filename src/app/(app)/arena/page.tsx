
"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle, CheckCircle, Send, UsersRound, Target, Zap, Swords, UserSquare2, Sparkles, HelpCircle, Brain, Coins as CoinsIcon, TimerIcon, Flag, LogOut, PlaySquare, Info, Award } from 'lucide-react';
import type { GenerateCodingChallengeOutput, TestCase } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import type { CompareCodeSubmissionsOutput } from '@/ai/flows/compare-code-submissions';
import { compareCodeSubmissions } from '@/ai/flows/compare-code-submissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { GameTimer } from './_components/GameTimer';
import { ProblemDisplay } from './_components/ProblemDisplay';
import type { Player, MatchHistoryEntry, SupportedLanguage, Battle } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToastAction } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { checkAchievementsOnMatchEnd } from '@/lib/achievement-logic';
import { db } from '@/lib/firebase';
import { collection, query, where, limit, getDocs, addDoc, doc, onSnapshot, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";

const DEFAULT_LANGUAGE: SupportedLanguage = "javascript";
const COMMISSION_RATE = 0.05; // 5% commission

type GameState = 'selectingLobby' | 'searching' | 'inGame' | 'submittingComparison' | 'gameOver';
type DifficultyLobby = 'easy' | 'medium' | 'hard';

interface LobbyInfo {
  name: DifficultyLobby;
  title: string;
  description: string;
  icon: React.ElementType;
  baseTime: number; // minutes
  entryFee: number;
}

const LOBBIES: LobbyInfo[] = [
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 5, entryFee: 50 },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 10, entryFee: 100 },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 15, entryFee: 200 },
];

interface TestResult {
  testCaseName: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  status: 'pass' | 'fail' | 'error' | 'not_run' | 'client_unsupported';
  errorMessage?: string;
}

function LobbyCard({ lobby, onSelectLobby, disabled }: { lobby: LobbyInfo; onSelectLobby: (difficulty: DifficultyLobby) => void; disabled?: boolean; }) {
  return (
    <Card className={`hover:shadow-lg transition-shadow ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} flex flex-col`}>
      <CardHeader className="items-center text-center">
        <lobby.icon className="h-12 w-12 text-primary mb-3" />
        <CardTitle className="text-2xl">{lobby.title}</CardTitle>
        <CardDescription>{lobby.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-2 text-sm text-muted-foreground flex-grow">
        <p className="font-semibold text-primary">Entry Fee: {lobby.entryFee} <CoinsIcon className="inline h-4 w-4 text-yellow-500" /></p>
      </CardContent>
      <CardFooter>
        <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => !disabled && onSelectLobby(lobby.name)}
            disabled={disabled}
        >
          Join {lobby.name.charAt(0).toUpperCase() + lobby.name.slice(1)} Lobby
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ArenaPage() {
  const { player, setPlayer } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState>('selectingLobby');
  const [selectedLobbyName, setSelectedLobbyName] = useState<DifficultyLobby | null>(null);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [isTestingCode, setIsTestingCode] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  // Real-time battle state
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleData, setBattleData] = useState<Battle | null>(null);
  const battleDataRef = useRef(battleData);
  useEffect(() => { battleDataRef.current = battleData }, [battleData]);

  const resetGameState = (backToLobbySelection = true) => {
    if (backToLobbySelection) {
      setGameState('selectingLobby');
      setSelectedLobbyName(null);
    }
    setCode('');
    setLanguage(DEFAULT_LANGUAGE);
    setIsTestingCode(false);
    setTestResults([]);
    setTimeRemaining(0);
    setShowLeaveConfirm(false);
    setBattleId(null);
    setBattleData(null);
  };

  const showAchievementToast = useCallback((achievement) => {
    toast({
        title: <div className="flex items-center gap-2"><Award className="h-6 w-6 text-yellow-400" /><span className="font-semibold">Achievement Unlocked!</span></div>,
        description: <div><p className="font-medium text-lg">{achievement.name}</p>{achievement.reward && (<p className="mt-1 text-sm text-green-500 font-bold flex items-center gap-1">+ {achievement.reward.amount} <CoinsIcon className="h-4 w-4" /></p>)}</div>,
        duration: 8000,
        className: "bg-accent text-accent-foreground border-yellow-400",
    });
  }, [toast]);
  
  const addMatchToHistory = useCallback((currentPlayer: Player, battle: Battle, outcome: 'win' | 'loss' | 'draw'): Player => {
    if (!battle) return currentPlayer;

    const opponentInfo = player?.id === battle.player1.id ? battle.player2 : battle.player1;

    const newEntry: MatchHistoryEntry = {
      matchId: battle.id,
      opponent: { username: opponentInfo?.username || 'Unknown', avatarUrl: opponentInfo?.avatarUrl },
      outcome: outcome,
      difficulty: battle.difficulty,
      wager: battle.wager,
      date: new Date().toISOString().split('T')[0],
    };
    
    return { ...currentPlayer, matchHistory: [newEntry, ...(currentPlayer.matchHistory || [])] };
  }, [player]);

 const handleSubmissionFinalization = useCallback(async (currentBattle: Battle) => {
    if (!player || !currentBattle.player2) {
      toast({ title: "Error", description: "Critical battle data missing.", variant: "destructive" });
      return;
    }
    
    try {
      const result = await compareCodeSubmissions({
        player1Code: currentBattle.player1.code || "",
        player2Code: currentBattle.player2.code || "",
        player1Language: currentBattle.player1.language,
        player2Language: currentBattle.player2.language,
        referenceSolution: currentBattle.question.solution,
        problemStatement: currentBattle.question.problemStatement,
        difficulty: currentBattle.difficulty,
      });

      let winnerId;
      if (result.winner === 'player1') winnerId = currentBattle.player1.id;
      if (result.winner === 'player2') winnerId = currentBattle.player2.id;
      
      await updateDoc(doc(db, 'battles', currentBattle.id), {
        status: 'completed',
        winnerId: winnerId || null,
        comparisonResult: JSON.parse(JSON.stringify(result)) // Serialize for Firestore
      });

    } catch (error) {
      console.error("Error during code comparison:", error);
      toast({ title: "Comparison Error", description: "Could not compare submissions.", variant: "destructive" });
      await updateDoc(doc(db, 'battles', currentBattle.id), { status: 'completed' });
    }
  }, [player, toast]);

  const findOrCreateBattle = useCallback(async (lobby: LobbyInfo) => {
    if (!player) return;

    setGameState('searching');
    setSelectedLobbyName(lobby.name);
    setTestResults([]);

    const waitingBattlesQuery = query(
        collection(db, "battles"), 
        where("difficulty", "==", lobby.name), 
        where("status", "==", "waiting"),
        limit(1)
    );

    const querySnapshot = await getDocs(waitingBattlesQuery);

    if (!querySnapshot.empty) {
        // Join an existing battle
        const battleDoc = querySnapshot.docs[0];
        setBattleId(battleDoc.id);

        const player2Data = {
            id: player.id,
            username: player.username,
            avatarUrl: player.avatarUrl,
            language: DEFAULT_LANGUAGE,
            code: getCodePlaceholder(DEFAULT_LANGUAGE, battleDoc.data().question),
            hasSubmitted: false
        };
        await updateDoc(battleDoc.ref, {
            player2: player2Data,
            status: "in-progress",
            startedAt: serverTimestamp()
        });
        toast({ title: "Opponent Found!", description: `Joined duel against ${battleDoc.data().player1.username}`, className: "bg-green-500 text-white" });

    } else {
        // Create a new battle
        try {
            const question = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobby.name });
            if (!question.solution) throw new Error("AI failed to provide a valid solution.");

            const player1Data = {
                id: player.id,
                username: player.username,
                avatarUrl: player.avatarUrl,
                language: DEFAULT_LANGUAGE,
                code: getCodePlaceholder(DEFAULT_LANGUAGE, question),
                hasSubmitted: false
            };

            const newBattleDoc = await addDoc(collection(db, "battles"), {
                player1: player1Data,
                status: "waiting",
                difficulty: lobby.name,
                wager: lobby.entryFee,
                question,
                createdAt: serverTimestamp(),
            });
            setBattleId(newBattleDoc.id);
            toast({ title: "Lobby Created", description: "Waiting for an opponent to join your duel." });
        } catch(e) {
            console.error("Failed to create battle:", e);
            toast({ title: "Error Creating Match", description: "Could not generate a challenge. Please try again.", variant: "destructive" });
            resetGameState(true);
             const refundedPlayer = { ...player, coins: player.coins + lobby.entryFee };
             setPlayer(refundedPlayer);
        }
    }
  }, [player, setPlayer, toast]);


  const handleSelectLobby = (lobbyName: DifficultyLobby) => {
    if (!player) return;

    const lobbyInfo = LOBBIES.find(l => l.name === lobbyName);
    if (!lobbyInfo) return;

    if (player.coins < lobbyInfo.entryFee) {
        toast({ title: "Insufficient Coins", description: `You need ${lobbyInfo.entryFee} coins to enter.`, variant: "destructive", action: <ToastAction altText="Buy Coins" onClick={() => router.push('/buy-coins')}>Buy Coins</ToastAction> });
        return;
    }

    const updatedPlayer = { ...player, coins: player.coins - lobbyInfo.entryFee };
    setPlayer(updatedPlayer);

    toast({ title: "Joining Lobby...", description: `${lobbyInfo.entryFee} coins deducted for entry. Good luck!`, className: "bg-primary text-primary-foreground" });
    findOrCreateBattle(lobbyInfo);
  };
  
    // Real-time listener for battle updates
  useEffect(() => {
    if (!battleId || !player) return;

    const unsub = onSnapshot(doc(db, "battles", battleId), async (docSnap) => {
      if (!docSnap.exists()) {
        toast({ title: "Battle Error", description: "The battle you were in could not be found.", variant: 'destructive' });
        resetGameState(true);
        return;
      }
      
      const battle = { id: docSnap.id, ...docSnap.data() } as Battle;
      setBattleData(battle);
      
      if (battle.status === 'in-progress' && gameState !== 'inGame') {
        setGameState('inGame');
        setTimeRemaining(LOBBIES.find(l => l.name === battle.difficulty)!.baseTime * 60);
      }
      
      if(battle.status === 'completed' || battle.status === 'forfeited') {
         if(gameState !== 'gameOver') {
            const currentBattle = battleDataRef.current;
            if(currentBattle?.status !== 'completed' && currentBattle?.status !== 'forfeited') {
               // This is the first time we are processing the game over state
               const entryFee = battle.wager;
               let outcome: 'win' | 'loss' | 'draw' = 'draw';
               let toastTitle = "Match Over";
               let toastDesc = "The match has concluded.";
               let toastVariant: "default" | "destructive" = "default";

               if(battle.status === 'forfeited') {
                   if (battle.winnerId === player.id) {
                       outcome = 'win';
                       const winnings = (entryFee * 2) - Math.floor(entryFee * 2 * COMMISSION_RATE);
                       toastTitle="Victory by Forfeit!";
                       toastDesc=`Your opponent forfeited. You won ${winnings} coins.`;
                   } else {
                       outcome = 'loss';
                       toastTitle="You Forfeited";
                       toastDesc=`You forfeited the match and lost ${entryFee} coins.`;
                       toastVariant="destructive";
                   }
               } else { // Completed
                  if (battle.winnerId === player.id) {
                     outcome = 'win';
                     const winnings = (entryFee * 2) - Math.floor(entryFee * 2 * COMMISSION_RATE);
                     toastTitle="Victory!";
                     toastDesc=`You won the duel! You won ${winnings} coins.`;
                  } else if (!battle.winnerId) {
                     outcome = 'draw';
                     toastTitle="Draw!";
                     toastDesc=`The duel ended in a draw. Your entry fee of ${entryFee} coins was refunded.`;
                  } else {
                     outcome = 'loss';
                     toastTitle="Defeat";
                     toastDesc="Your opponent's solution was deemed superior.";
                     toastVariant="destructive";
                  }
               }

               const opponentInfo = player.id === battle.player1.id ? battle.player2 : battle.player1;
               const achievementResult = checkAchievementsOnMatchEnd(player, { won: outcome === 'win', opponentRank: 10, lobbyDifficulty: battle.difficulty }); // Mock opponent rank

               let finalPlayer = achievementResult.updatedPlayer;
               if (outcome === 'win') {
                   const winnings = (entryFee * 2) - Math.floor(entryFee * 2 * COMMISSION_RATE);
                   finalPlayer = { ...finalPlayer, coins: finalPlayer.coins + winnings };
               } else if (outcome === 'draw') {
                   finalPlayer = { ...finalPlayer, coins: finalPlayer.coins + entryFee };
               }
               
               const playerWithHistory = addMatchToHistory(finalPlayer, battle, outcome);
               setPlayer(playerWithHistory);
               
               toast({ title: toastTitle, description: toastDesc, variant: toastVariant, duration: 7000 });
               achievementResult.newlyUnlocked.forEach(showAchievementToast);
            }
         }
         setGameState('gameOver');
      }
      
      if (battle.status === 'comparing' && gameState !== 'submittingComparison' && gameState !== 'gameOver') {
        setGameState('submittingComparison');
      }

      if (battle.player1.hasSubmitted && battle.player2?.hasSubmitted && battle.status === 'in-progress') {
        if (player.id === battle.player1.id) { // Designate P1 to trigger comparison
          await updateDoc(docSnap.ref, { status: 'comparing' });
          handleSubmissionFinalization(battle);
        }
      }
    });

    return () => unsub();
  }, [battleId, player, setPlayer, addMatchToHistory, showAchievementToast, handleSubmissionFinalization, gameState, toast, router]);


  const handleSubmitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim() || !battleData || !player) return;

    const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
    if (!playerKey || battleData[playerKey]?.hasSubmitted) return;

    const updatePayload = {
        [`${playerKey}.code`]: code,
        [`${playerKey}.hasSubmitted`]: true
    };

    await updateDoc(doc(db, "battles", battleData.id), updatePayload);
    toast({ title: "Code Submitted!", description: "Your solution is locked in.", className: "bg-primary text-primary-foreground" });
  };

  const handleTimeUp = async () => {
    if (!battleData || !player) return;

    // A simple timeout implementation: first to timeout while opponent has submitted, loses.
    // If both timeout, it's a draw handled by server function later. For now, we'll make it a loss if you're late.
    const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
    if (opponent?.hasSubmitted) {
        await updateDoc(doc(db, "battles", battleData.id), {
            status: 'forfeited',
            winnerId: opponent.id
        });
    } else {
        // More complex scenarios (e.g. who timed out first) are better handled server-side.
        // For now, we just show a timeout message. The game will end in a draw if no one submits.
        toast({ title: "Time's Up!", description: "The timer has expired.", variant: "destructive" });
    }
  };


  const handleLeaveConfirm = async () => {
    if (!player) return;
    setShowLeaveConfirm(false);

    const isSearching = gameState === 'searching';
    const isInGame = gameState === 'inGame';
    
    // Refund for cancelling search
    if (isSearching && battleData && player) {
        const batch = writeBatch(db);
        const battleRef = doc(db, 'battles', battleData.id);
        batch.delete(battleRef);
        await batch.commit();

        const lobby = LOBBIES.find(l => l.name === selectedLobbyName);
        if (lobby) {
            const refundedPlayer = { ...player, coins: player.coins + lobby.entryFee };
            setPlayer(refundedPlayer);
            toast({ title: "Search Cancelled", description: `You left the lobby. Your entry fee has been refunded.`, variant: "default" });
        }
        resetGameState(true);
    } 
    // Forfeit game
    else if (isInGame && battleData && player) {
        const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
        if (opponent) {
             await updateDoc(doc(db, 'battles', battleData.id), {
                status: 'forfeited',
                winnerId: opponent.id
             });
        } else { // Should not happen in PvP
             resetGameState(true);
        }
    }
  };

  const getCodePlaceholder = (selectedLang: SupportedLanguage, currentQuestion: GenerateCodingChallengeOutput | null): string => {
    const signatureFromAI = currentQuestion?.functionSignature;
    if (selectedLang === 'javascript') {
        if (signatureFromAI) return `${signatureFromAI.replace(/;\s*$/, '')} {\n  // Your code here\n\n  return;\n}`;
        return `function solve(params) {\n  // Your code here\n  return;\n}`;
    } else if (selectedLang === 'python') {
        if (signatureFromAI) return `${signatureFromAI.replace(/:\s*$/, '')}:\n  # Your code here\n  pass\n`;
        return `def solve(params):\n  # Your code here\n  pass\n`;
    } else if (selectedLang === 'cpp') {
        let methodSignature = `void solve(/* parameters */) {\n    // Your code here\n  }`;
        if (signatureFromAI) methodSignature = `${signatureFromAI.replace(/;\s*$/, '')} {\n    // Your code here\n  }`;
        return `#include <iostream>\n\nclass Solution {\npublic:\n  ${methodSignature}\n};\n`;
    }
    return `// Placeholder for ${selectedLang}.`;
  };

  useEffect(() => {
    if (battleData?.question && language) {
      setCode(getCodePlaceholder(language, battleData.question));
      setTestResults([]); 
    }
  }, [language, battleData?.question]);

  const handleRunTests = async () => { /* Test running logic unchanged for now */ };

  const onLanguageChange = async (newLang: SupportedLanguage) => {
    if (!player || !battleData) return;
    setLanguage(newLang);
    const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
    await updateDoc(doc(db, 'battles', battleData.id), {
        [`${playerKey}.language`]: newLang
    });
  }

  const renderContent = () => {
    if (gameState === 'selectingLobby') { /* ... Lobby selection UI ... */ }
    if (gameState === 'searching') { /* ... Searching UI ... */ }
    if (gameState === 'submittingComparison') { /* ... Submitting comparison UI ... */ }
    if (gameState === 'gameOver') { /* ... Game over UI ... */ }
    if (gameState === 'inGame') { /* ... In-game UI ... */ }
    /* The rest of the render logic needs significant updates based on `battleData` */
    // Placeholder for brevity, but this would be a full rewrite
    
    if (gameState === 'selectingLobby') {
      return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center">
          <Card className="mb-8 shadow-lg">
            <CardHeader className="text-center">
              <Swords className="h-16 w-16 mx-auto text-primary mb-4"/>
              <CardTitle className="text-3xl font-bold">Choose Your Arena</CardTitle>
              <CardDescription className="text-lg">Select a lobby. Entry fees apply. Current Coins: {player?.coins ?? 0} <CoinsIcon className="inline h-5 w-5 text-yellow-500 align-text-bottom" /></CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6">
              {LOBBIES.map(lobby => (
                <LobbyCard key={lobby.name} lobby={lobby} onSelectLobby={handleSelectLobby} disabled={!player || player.coins < lobby.entryFee}/>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }
    
    if (gameState === 'searching') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Waiting for an Opponent...</h2>
          <p className="text-muted-foreground">Searching in the <span className="font-medium text-primary">{selectedLobbyName}</span> lobby.</p>
          <Button variant="outline" onClick={() => setShowLeaveConfirm(true)} className="mt-6">
              <LogOut className="mr-2 h-4 w-4" /> Cancel Search
          </Button>
        </div>
      );
    }

    if (gameState === 'submittingComparison') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Sparkles className="h-16 w-16 animate-pulse text-accent mb-6" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Duel Concluded: AI is Comparing Submissions...</h2>
          <p className="text-muted-foreground">Our AI is evaluating both solutions to determine the victor. This may take a moment.</p>
        </div>
      );
    }

    if (gameState === 'gameOver' && battleData) {
      const outcome = battleData.winnerId === player?.id ? 'win' : (!battleData.winnerId ? 'draw' : 'loss');
      let title = "Match Over";
      let message = "";
      let icon: React.ReactNode = <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;
      const opponent = battleData.player1.id === player?.id ? battleData.player2 : battleData.player1;

      if(battleData.status === 'forfeited'){
          title = outcome === 'win' ? "Victory by Forfeit!" : "Match Forfeited";
          message = outcome === 'win' ? `Your opponent forfeited. You won the wager!` : `You forfeited the match and lost your wager.`;
          icon = outcome === 'win' ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4"/> : <Flag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;
      } else { // 'completed'
          title = outcome === 'win' ? 'Victory!' : (outcome === 'draw' ? "It's a Draw!" : "Defeat!");
          message = outcome === 'win' ? `You defeated ${opponent?.username || 'your opponent'}!` : (outcome === 'draw' ? `The duel ended in a draw.` : `${opponent?.username || 'Your opponent'} won the duel.`);
          icon = outcome === 'win' ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4"/> : (outcome === 'draw' ? <Swords className="h-16 w-16 text-yellow-500 mx-auto mb-4"/> : <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4"/>);
      }
      
      const comparisonResult = battleData.comparisonResult;

      return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center p-4">
          <Card>
            <CardHeader className="text-center">
              {icon}
              <CardTitle className="text-3xl font-bold mb-2">{title}</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">{message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {comparisonResult && (
                 <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="comparison-details">
                    <AccordionTrigger className="text-lg hover:no-underline"><Brain className="mr-2 h-5 w-5 text-primary"/> Detailed AI Duel Report</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                      {/* Detailed report UI goes here, using comparisonResult */}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
               <div className="text-center text-muted-foreground">Your coins: {player?.coins ?? 0} <CoinsIcon className="inline h-4 w-4 text-yellow-500 align-baseline"/></div>
              <Button onClick={() => resetGameState(true)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
               Play Again (Back to Lobbies)
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    if (gameState === 'inGame' && battleData && player) {
      const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
      const me = battleData.player1.id === player.id ? battleData.player1 : battleData.player2;
      
      if (!opponent) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/>Waiting for opponent...</div>;
      
      return (
        <div className="flex flex-col gap-4 h-full p-4 md:p-6">
          <Card className="shadow-md shrink-0">
             <CardContent className="p-3 flex justify-around items-center text-sm">
                {/* Player 1 Info */}
                <div className="flex items-center gap-2"><UserSquare2 className="h-8 w-8 text-blue-500" /><p className="font-semibold text-foreground">{battleData.player1.username}</p></div>
                <div className="text-center"><Swords className="h-6 w-6 text-muted-foreground mx-auto"/><p className="text-xs text-primary font-medium">{battleData.difficulty}</p></div>
                {/* Player 2 Info */}
                <div className="flex items-center gap-2"><UserSquare2 className="h-8 w-8 text-red-500" /><p className="font-semibold text-foreground">{battleData.player2?.username || '???'}</p></div>
             </CardContent>
          </Card>

          <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-0">
              <Card className="lg:w-1/2 flex flex-col shadow-xl overflow-hidden">
                <CardHeader className="bg-card-foreground/5">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-2xl text-primary">Coding Challenge</CardTitle>
                        <GameTimer initialTime={timeRemaining} onTimeUp={handleTimeUp} />
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-grow overflow-y-auto">
                    <ProblemDisplay question={battleData.question} />
                </CardContent>
              </Card>

              <Card className="lg:w-1/2 flex flex-col shadow-xl overflow-hidden">
                <CardHeader className="bg-card-foreground/5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><CardTitle className="text-2xl">Your Solution</CardTitle></div>
                      <Select value={language} onValueChange={onLanguageChange} disabled={me?.hasSubmitted}>
                          <SelectTrigger className="w-[180px] bg-background"><SelectValue placeholder="Select language" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="cpp">C++</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    {opponent.hasSubmitted && !me?.hasSubmitted && <p className="mt-2 text-sm text-yellow-600 animate-pulse">Opponent has submitted!</p>}
                    {me?.hasSubmitted && !opponent.hasSubmitted && <p className="mt-2 text-sm text-blue-600">Your code is submitted. Waiting for opponent...</p>}
                </CardHeader>
                <CardContent className="flex-grow p-4 flex flex-col min-h-0">
                    <Textarea value={code} onChange={(e) => setCode(e.target.value)} disabled={me?.hasSubmitted} className="flex-grow font-mono text-sm resize-none" />
                </CardContent>
                 <div className="p-4 border-t flex flex-col gap-2">
                    <Button onClick={handleSubmitCode} disabled={me?.hasSubmitted || !code.trim()} className="w-full">
                        {me?.hasSubmitted ? "Code Submitted" : "Submit for Final AI Duel"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowLeaveConfirm(true)} disabled={me?.hasSubmitted} className="w-full">
                        <Flag className="mr-2 h-4 w-4" /> Forfeit Match
                    </Button>
                 </div>
              </Card>
          </div>
        </div>
      );
    }
    
    return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading match...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  const isFullScreenState = gameState === 'searching' || gameState === 'inGame' || gameState === 'submittingComparison' || gameState === 'gameOver';

  return (
    <>
      {!isFullScreenState && renderContent()}
      {isFullScreenState && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col items-stretch justify-start p-0 overflow-auto">
          <div className="flex-grow flex flex-col">
             {renderContent()}
          </div>
        </div>
      )}
      <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={gameState === 'searching' ? 'search' : 'game'}/>
    </>
  );
}

export function ArenaLeaveConfirmationDialog({ open, onOpenChange, onConfirm, type }: { open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void, type: 'search' | 'game' | null }) {
  if (!type) return null;
  const title = type === 'search' ? "Cancel Search?" : "Forfeit Match?";
  let description = type === 'search' ? "Are you sure you want to cancel the search? Your entry fee will be refunded." : "Are you sure you want to forfeit? This will count as a loss, and your wager will be lost.";
    
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="z-[100]"> 
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={cn(type === 'game' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground')}>
            {type === 'search' ? "Leave" : "Forfeit"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
