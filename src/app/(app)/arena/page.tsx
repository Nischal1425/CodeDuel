
"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UsersRound, Target, Zap, Sparkles } from 'lucide-react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import type { CompareCodeSubmissionsInput } from '@/ai/flows/compare-code-submissions';
import { compareCodeSubmissions } from '@/ai/flows/compare-code-submissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import type { Player, MatchHistoryEntry, SupportedLanguage, Battle } from '@/types';
import { ToastAction } from "@/components/ui/toast";
import { cn } from '@/lib/utils';
import { checkAchievementsOnMatchEnd } from '@/lib/achievement-logic';
import { db } from '@/lib/firebase';
import { collection, query, where, limit, getDocs, addDoc, doc, onSnapshot, updateDoc, serverTimestamp, deleteDoc, arrayUnion, runTransaction } from "firebase/firestore";

// Component Imports
import { LobbySelection } from './_components/LobbySelection';
import type { DifficultyLobby, LobbyInfo } from './_components/LobbySelection';
import { SearchingView } from './_components/SearchingView';
import { DuelView } from './_components/DuelView';
import { GameOverReport } from './_components/GameOverReport';


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const DEFAULT_LANGUAGE: SupportedLanguage = "javascript";
const COMMISSION_RATE = 0.05; // 5% commission

type GameState = 'selectingLobby' | 'searching' | 'inGame' | 'submittingComparison' | 'gameOver';

const LOBBIES: LobbyInfo[] = [
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 5, entryFee: 50 },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 10, entryFee: 100 },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 15, entryFee: 200 },
];

export default function ArenaPage() {
  const { player } = useAuth(); // AuthProvider now gives us a real-time player object
  const { toast } = useToast();
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState>('selectingLobby');
  const [selectedLobbyName, setSelectedLobbyName] = useState<DifficultyLobby | null>(null);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
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
    setTimeRemaining(0);
    setShowLeaveConfirm(false);
    setBattleId(null);
    setBattleData(null);
  };

  const showAchievementToast = useCallback((achievement) => {
    toast({
        title: <div className="flex items-center gap-2"><span className="font-semibold">Achievement Unlocked!</span></div>,
        description: <div><p className="font-medium text-lg">{achievement.name}</p>{achievement.reward && (<p className="mt-1 text-sm text-green-500 font-bold flex items-center gap-1">+ {achievement.reward.amount}</p>)}</div>,
        duration: 8000,
        className: "bg-accent text-accent-foreground border-yellow-400",
    });
  }, [toast]);
  

 const processGameEnd = useCallback(async (battle: Battle) => {
    if (!player) return;
    
    // Ensure this runs only once per player per match conclusion
    const hasProcessedKey = `processed_match_${battle.id}`;
    if (sessionStorage.getItem(hasProcessedKey)) return;
    sessionStorage.setItem(hasProcessedKey, 'true');

    const entryFee = battle.wager;
    let outcome: 'win' | 'loss' | 'draw' = 'draw';
    let toastTitle = "Match Over";
    let toastDesc = "The match has concluded.";
    let toastVariant: "default" | "destructive" = "default";
    let coin_change = 0;

    if (battle.status === 'forfeited') {
        if (battle.winnerId === player.id) {
            outcome = 'win';
            const winnings = (entryFee * 2) - Math.floor(entryFee * 2 * COMMISSION_RATE);
            coin_change = winnings - entryFee; // Net gain
            toastTitle="Victory by Forfeit!";
            toastDesc=`Your opponent forfeited. You won ${winnings} coins.`;
        } else {
            outcome = 'loss';
            coin_change = -entryFee;
            toastTitle="You Forfeited";
            toastDesc=`You forfeited the match and lost ${entryFee} coins.`;
            toastVariant="destructive";
        }
    } else { // Completed
        if (battle.winnerId === player.id) {
            outcome = 'win';
            const winnings = (entryFee * 2) - Math.floor(entryFee * 2 * COMMISSION_RATE);
            coin_change = winnings - entryFee; // Net gain
            toastTitle="Victory!";
            toastDesc=`You won the duel! You won ${winnings} coins.`;
        } else if (!battle.winnerId) {
            outcome = 'draw';
            coin_change = 0; // Fee already deducted, now refunded effectively
            toastTitle="Draw!";
            toastDesc=`The duel ended in a draw. Your entry fee of ${entryFee} coins was refunded.`;
        } else {
            outcome = 'loss';
            coin_change = -entryFee;
            toastTitle="Defeat";
            toastDesc="Your opponent's solution was deemed superior.";
            toastVariant="destructive";
        }
    }

    const opponentInfo = player.id === battle.player1.id ? battle.player2 : battle.player1;
    const opponentRank = opponentInfo?.id === 'bot-player' ? player.rank : (opponentInfo ? 10 : player.rank);

    const achievementResult = checkAchievementsOnMatchEnd(player, { won: outcome === 'win', opponentRank, lobbyDifficulty: battle.difficulty });
    
    const finalPlayerStats = achievementResult.updatedPlayer;

    const newMatchHistoryEntry: MatchHistoryEntry = {
      matchId: battle.id,
      opponent: { username: opponentInfo?.username || 'Unknown', avatarUrl: opponentInfo?.avatarUrl },
      outcome: outcome,
      difficulty: battle.difficulty,
      wager: battle.wager,
      date: new Date().toISOString().split('T')[0],
    };

    try {
        if (IS_FIREBASE_CONFIGURED) {
             await runTransaction(db, async (transaction) => {
                const playerRef = doc(db, "players", player.id);
                const playerDoc = await transaction.get(playerRef);
                if (!playerDoc.exists()) throw "Player document does not exist!";

                const currentCoins = playerDoc.data().coins || 0;
                
                let newCoins;
                if(outcome === 'draw'){
                    newCoins = currentCoins + battle.wager; // Refund
                } else {
                    newCoins = currentCoins + (outcome === 'win' ? (battle.wager * 2 * (1-COMMISSION_RATE)) : 0);
                }

                transaction.update(playerRef, {
                    coins: Math.floor(newCoins),
                    matchesPlayed: finalPlayerStats.matchesPlayed,
                    wins: finalPlayerStats.wins,
                    losses: finalPlayerStats.losses,
                    winStreak: finalPlayerStats.winStreak,
                    unlockedAchievements: finalPlayerStats.unlockedAchievements,
                    matchHistory: arrayUnion(newMatchHistoryEntry)
                });
            });
        }
    } catch (error) {
        console.error("Failed to update player stats in Firestore:", error);
        toast({ title: "Sync Error", description: "Could not save match results to your profile.", variant: "destructive" });
    }
    
    toast({ title: toastTitle, description: toastDesc, variant: toastVariant, duration: 7000 });
    achievementResult.newlyUnlocked.forEach(showAchievementToast);
    setTimeout(() => sessionStorage.removeItem(hasProcessedKey), 5000); // Cleanup session lock
  }, [player, showAchievementToast, toast]);


 const handleSubmissionFinalization = useCallback(async (currentBattle: Battle) => {
    if (!player || (!currentBattle.player2 && IS_FIREBASE_CONFIGURED)) {
      toast({ title: "Error", description: "Critical battle data missing.", variant: "destructive" });
      return;
    }
    
    try {
      const submissionInput: CompareCodeSubmissionsInput = {
        player1Code: currentBattle.player1.code || "",
        player2Code: currentBattle.player2?.code || "",
        player1Language: currentBattle.player1.language,
        player2Language: currentBattle.player2!.language,
        referenceSolution: currentBattle.question.solution,
        problemStatement: currentBattle.question.problemStatement,
        difficulty: currentBattle.difficulty,
      };

      const result = await compareCodeSubmissions(submissionInput);

      let winnerId;
      if (result.winner === 'player1') winnerId = currentBattle.player1.id;
      if (result.winner === 'player2') winnerId = currentBattle.player2!.id;
      
      const finalBattleState: Battle = {
        ...currentBattle,
        status: 'completed',
        winnerId: winnerId || undefined,
        comparisonResult: JSON.parse(JSON.stringify(result)) // Serialize for Firestore/state
      };
      
      if (IS_FIREBASE_CONFIGURED) {
          await updateDoc(doc(db, 'battles', currentBattle.id), {
            status: 'completed',
            winnerId: winnerId || null,
            comparisonResult: JSON.parse(JSON.stringify(result)) // Serialize for Firestore
          });
      } else {
          // Bot mode: update local state and finalize
          setBattleData(finalBattleState);
          processGameEnd(finalBattleState);
          setGameState('gameOver');
      }

    } catch (error) {
      console.error("Error during code comparison:", error);
      toast({ title: "Comparison Error", description: "Could not compare submissions.", variant: "destructive" });
      if (IS_FIREBASE_CONFIGURED) {
         await updateDoc(doc(db, 'battles', currentBattle.id), { status: 'completed' });
      } else {
        setBattleData({ ...currentBattle, status: 'completed' });
        setGameState('gameOver');
      }
    }
  }, [player, toast, processGameEnd]);

  const findOrCreateBattle = useCallback(async (lobby: LobbyInfo) => {
    if (!player) return;

    setGameState('searching');
    setSelectedLobbyName(lobby.name);

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
            // Refund fee on failure
            const playerRef = doc(db, "players", player.id);
            await updateDoc(playerRef, { coins: player.coins + lobby.entryFee });
        }
    }
  }, [player, toast]);

  const startBotMatch = useCallback(async (lobby: LobbyInfo) => {
      if (!player) return;
      
      setGameState('searching');
      setSelectedLobbyName(lobby.name);

      try {
          const question = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobby.name });
          if (!question.solution) throw new Error("AI failed to provide a valid challenge.");

          const botOpponent = {
              id: 'bot-player',
              username: 'DuelBot 9331',
              avatarUrl: 'https://placehold.co/100x100.png?text=🤖',
              language: 'javascript' as SupportedLanguage,
              code: question.solution,
              hasSubmitted: true // Bot submits instantly
          };
          
          const player1Data = {
              id: player.id,
              username: player.username,
              avatarUrl: player.avatarUrl,
              language: DEFAULT_LANGUAGE,
              code: getCodePlaceholder(DEFAULT_LANGUAGE, question),
              hasSubmitted: false
          };

          const mockBattle: Battle = {
              id: `bot-match-${Date.now()}`,
              player1: player1Data,
              player2: botOpponent,
              status: 'in-progress',
              difficulty: lobby.name,
              wager: lobby.entryFee,
              question,
              createdAt: new Date(),
              startedAt: new Date(),
          };

          setBattleData(mockBattle);
          setGameState('inGame');
          setTimeRemaining(lobby.baseTime * 60);

          toast({ title: "Opponent Found!", description: "You are dueling against DuelBot 9331.", className: "bg-green-500 text-white" });

      } catch (e) {
          console.error("Failed to create bot match:", e);
          toast({ title: "Error Creating Match", description: "Could not generate a challenge. Please try again.", variant: "destructive" });
          resetGameState(true);
          // Bot mode doesn't need firestore refund, local state was updated optimistically
      }
  }, [player, toast]);

  const handleSelectLobby = async (lobbyName: DifficultyLobby) => {
    if (!player) return;

    const lobbyInfo = LOBBIES.find(l => l.name === lobbyName);
    if (!lobbyInfo) return;

    if (player.coins < lobbyInfo.entryFee) {
        toast({ title: "Insufficient Coins", description: `You need ${lobbyInfo.entryFee} coins to enter.`, variant: "destructive", action: <ToastAction altText="Buy Coins" onClick={() => router.push('/buy-coins')}>Buy Coins</ToastAction> });
        return;
    }

    toast({ title: "Joining Lobby...", description: `${lobbyInfo.entryFee} coins deducted for entry. Good luck!`, className: "bg-primary text-primary-foreground" });
    
    if (IS_FIREBASE_CONFIGURED) {
      try {
        const playerRef = doc(db, "players", player.id);
        await updateDoc(playerRef, {
            coins: player.coins - lobbyInfo.entryFee
        });
        findOrCreateBattle(lobbyInfo);
      } catch (error) {
        toast({ title: "Error", description: "Failed to deduct coins. Please try again.", variant: "destructive" });
      }
    } else {
        // In bot mode, we don't persist coin changes, so we just proceed.
        // The coin balance will appear to decrease locally due to state updates, but will reset on refresh.
        startBotMatch(lobbyInfo);
    }
  };
  
    // Real-time listener for battle updates
  useEffect(() => {
    if (!battleId || !player || !IS_FIREBASE_CONFIGURED) return;

    const unsub = onSnapshot(doc(db, "battles", battleId), async (docSnap) => {
      if (!docSnap.exists()) {
        if (gameState !== 'selectingLobby') {
            toast({ title: "Match Canceled", description: "The opponent left or the match was removed.", variant: "default" });
            resetGameState(true);
        }
        return;
      }
      
      const currentGameState = gameState;
      const battle = { id: docSnap.id, ...docSnap.data() } as Battle;
      setBattleData(battle);
      
      if (battle.status === 'in-progress' && currentGameState !== 'inGame') {
        setGameState('inGame');
        setTimeRemaining(LOBBIES.find(l => l.name === battle.difficulty)!.baseTime * 60);
      }
      
      if(battle.status === 'completed' || battle.status === 'forfeited') {
         if(currentGameState !== 'gameOver') {
            const currentBattle = battleDataRef.current;
            if(currentBattle?.status !== 'completed' && currentBattle?.status !== 'forfeited') {
               processGameEnd(battle);
            }
         }
         setGameState('gameOver');
      }
      
      if (battle.status === 'comparing' && currentGameState !== 'submittingComparison' && currentGameState !== 'gameOver') {
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
  }, [battleId, player, handleSubmissionFinalization, toast, router, gameState, processGameEnd]);


  const handleSubmitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim() || !battleData || !player) return;

    const me = battleData.player1.id === player.id ? battleData.player1 : battleData.player2;
    if (me?.hasSubmitted) return;

    toast({ title: "Code Submitted!", description: "Your solution is locked in.", className: "bg-primary text-primary-foreground" });

    if (IS_FIREBASE_CONFIGURED) {
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        const updatePayload = {
            [`${playerKey}.code`]: code,
            [`${playerKey}.hasSubmitted`]: true
        };
        await updateDoc(doc(db, "battles", battleData.id), updatePayload);
    } else {
        // Bot mode: update local state and trigger comparison
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        if (!playerKey) return;

        const updatedBattle = {
            ...battleData,
            [playerKey]: {
                ...battleData[playerKey]!,
                code: code,
                hasSubmitted: true,
            }
        };
        setBattleData(updatedBattle);
        setGameState('submittingComparison');
        await handleSubmissionFinalization(updatedBattle);
    }
  };

  const handleTimeUp = async () => {
    if (!battleData || !player) return;
    
    if (IS_FIREBASE_CONFIGURED) {
        const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
        if (opponent?.hasSubmitted) {
            await updateDoc(doc(db, "battles", battleData.id), {
                status: 'forfeited',
                winnerId: opponent.id
            });
        } else {
            // Both timed out, becomes a draw. P1 handles the update.
            if(player.id === battleData.player1.id) {
               await updateDoc(doc(db, "battles", battleData.id), { status: 'completed', winnerId: null });
            }
            toast({ title: "Time's Up!", description: "The timer has expired.", variant: "destructive" });
        }
    } else {
        // Bot mode timeout
        toast({ title: "Time's Up!", description: "You ran out of time and lost the duel.", variant: "destructive" });
        const finalBattleState = { ...battleData, status: 'forfeited' as const, winnerId: 'bot-player' };
        setBattleData(finalBattleState);
        processGameEnd(finalBattleState);
        setGameState('gameOver');
    }
  };


  const handleLeaveConfirm = async () => {
    if (!player) return;
    setShowLeaveConfirm(false);

    const isSearching = gameState === 'searching';
    const isInGame = gameState === 'inGame';
    
    if (isSearching) {
        try {
            if (IS_FIREBASE_CONFIGURED && battleId) {
                // To prevent race conditions, only delete if the user is still player1 (creator)
                const battleDoc = await getDocs(query(collection(db, "battles"), where("id", "==", battleId)));
                const currentBattle = battleDoc.docs[0]?.data();
                if (currentBattle && currentBattle.player1.id === player.id && !currentBattle.player2) {
                    await deleteDoc(doc(db, 'battles', battleId));
                }
            }
            const lobby = LOBBIES.find(l => l.name === selectedLobbyName);
            if (lobby && IS_FIREBASE_CONFIGURED) {
                const playerRef = doc(db, "players", player.id);
                await updateDoc(playerRef, { coins: player.coins + lobby.entryFee });
                toast({ title: "Search Cancelled", description: `You left the lobby. Your entry fee has been refunded.`, variant: "default" });
            }
            resetGameState(true);
        } catch (error) {
            console.error("Error cancelling search:", error);
            toast({ title: "Error", description: "Could not cancel the search. Please try again.", variant: "destructive" });
            resetGameState(true);
        }
    } 
    else if (isInGame && battleData) {
        if (IS_FIREBASE_CONFIGURED) {
            const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
            if (opponent) {
                 await updateDoc(doc(db, 'battles', battleData.id), {
                    status: 'forfeited',
                    winnerId: opponent.id
                 });
            } else { 
                 resetGameState(true);
            }
        } else {
            // Bot mode forfeit
            const finalBattleState = { ...battleData, status: 'forfeited' as const, winnerId: 'bot-player' };
            setBattleData(finalBattleState);
            processGameEnd(finalBattleState);
            setGameState('gameOver');
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
    }
  }, [language, battleData?.question]);

  const onLanguageChange = async (newLang: SupportedLanguage) => {
    if (!player || !battleData) return;
    setLanguage(newLang);

    if (IS_FIREBASE_CONFIGURED) {
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        if (!battleData.player2 && playerKey === 'player2') return; // Cannot update player2 if not present
        await updateDoc(doc(db, 'battles', battleData.id), {
            [`${playerKey}.language`]: newLang
        });
    } else {
        // Update local state in bot mode
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        if (!playerKey) return;
        setBattleData({
            ...battleData,
            [playerKey]: { ...battleData[playerKey]!, language: newLang }
        });
    }
  }

  const renderContent = () => {
    switch (gameState) {
        case 'selectingLobby':
            return (
                <LobbySelection
                    lobbies={LOBBIES}
                    player={player}
                    onSelectLobby={handleSelectLobby}
                    isFirebaseConfigured={IS_FIREBASE_CONFIGURED}
                />
            );
        case 'searching':
            return (
                <SearchingView
                    selectedLobbyName={selectedLobbyName}
                    onCancelSearch={() => setShowLeaveConfirm(true)}
                />
            );
        case 'inGame':
            if (!battleData || !player) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading match...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
            }
            return (
                <DuelView
                    battleData={battleData}
                    player={player}
                    timeRemaining={timeRemaining}
                    code={code}
                    onCodeChange={setCode}
                    language={language}
                    onLanguageChange={onLanguageChange}
                    onSubmitCode={handleSubmitCode}
                    onTimeUp={handleTimeUp}
                    onForfeit={() => setShowLeaveConfirm(true)}
                />
            );
        case 'submittingComparison':
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <Sparkles className="h-16 w-16 animate-pulse text-accent mb-6" />
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Duel Concluded: AI is Comparing Submissions...</h2>
                    <p className="text-muted-foreground">Our AI is evaluating both solutions to determine the victor. This may take a moment.</p>
                </div>
            );
        case 'gameOver':
            if (!battleData || !player) {
                // Fallback if somehow we get here without data
                return (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <p className="mb-4">Match data not found.</p>
                        <Button onClick={() => resetGameState(true)}>Return to Lobby</Button>
                    </div>
                );
            }
            return (
                <GameOverReport
                    battleData={battleData}
                    player={player}
                    onFindNewMatch={() => resetGameState(true)}
                />
            );
        default:
            return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
    }
  }

  const isFullScreenState = gameState !== 'selectingLobby';

  return (
    <>
      <div className={cn(isFullScreenState && 'hidden')}>
        {renderContent()}
      </div>
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
