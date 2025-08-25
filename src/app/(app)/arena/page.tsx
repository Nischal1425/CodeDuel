
"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
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
import { collection, query, where, limit, getDocs, addDoc, doc, onSnapshot, updateDoc, serverTimestamp, deleteDoc, runTransaction, getDoc, writeBatch } from "firebase/firestore";


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
  const { player } = useAuth(); 
  const { toast } = useToast();
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState>('selectingLobby');
  const [selectedLobbyName, setSelectedLobbyName] = useState<DifficultyLobby | null>(null);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  const [battleId, setBattleId] = useState<string | null>(null);
  const [battleData, setBattleData] = useState<Battle | null>(null);

  const resetGameState = useCallback((backToLobbySelection = true) => {
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
  }, []);

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
    
    const hasProcessedKey = `processed_match_${battle.id}`;
    if (sessionStorage.getItem(hasProcessedKey)) return;
    sessionStorage.setItem(hasProcessedKey, 'true');

    const entryFee = battle.wager;
    let outcome: 'win' | 'loss' | 'draw' = 'draw';
    let toastTitle = "Match Over";
    let toastDesc = "The match has concluded.";
    let toastVariant: "default" | "destructive" = "default";
    
    if (battle.status === 'forfeited') {
        if (battle.winnerId === player.id) {
            outcome = 'win';
            toastTitle="Victory by Forfeit!";
            toastDesc=`Your opponent forfeited.`;
        } else {
            outcome = 'loss';
            toastTitle="You Forfeited";
            toastDesc=`You forfeited the match and lost your wager.`;
            toastVariant="destructive";
        }
    } else { // Completed
        if (battle.winnerId === player.id) {
            outcome = 'win';
            toastTitle="Victory!";
            toastDesc=`You won the duel!`;
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
    const opponentRank = opponentInfo?.id === 'bot-player' ? player.rank : (opponentInfo ? 10 : player.rank);

    const achievementResult = checkAchievementsOnMatchEnd(player, { won: outcome === 'win', opponentRank, lobbyDifficulty: battle.difficulty });
    
    const finalPlayerStats = achievementResult.updatedPlayer;

    const newMatchHistoryEntry: Omit<MatchHistoryEntry, 'id' | 'playerId'> = {
      matchId: battle.id,
      opponent: { username: opponentInfo?.username || 'Unknown', avatarUrl: opponentInfo?.avatarUrl },
      outcome: outcome,
      difficulty: battle.difficulty,
      wager: battle.wager,
      date: new Date().toISOString().split('T')[0],
    };

    try {
        if (IS_FIREBASE_CONFIGURED) {
             const batch = writeBatch(db);
             const playerRef = doc(db, "players", player.id);
             
             const playerSnap = await getDoc(playerRef);
             if (!playerSnap.exists()) throw new Error("Player not found during game end processing.");

             const currentCoins = playerSnap.data().coins || 0;
             let newCoins = currentCoins;
            
              if (outcome === 'win') {
                  newCoins += (battle.wager * 2 * (1 - COMMISSION_RATE));
              } else if (outcome === 'draw') {
                  newCoins += battle.wager; 
              }

             batch.update(playerRef, {
                 coins: Math.floor(newCoins),
                 matchesPlayed: finalPlayerStats.matchesPlayed,
                 wins: finalPlayerStats.wins,
                 losses: finalPlayerStats.losses,
                 winStreak: finalPlayerStats.winStreak,
                 unlockedAchievements: finalPlayerStats.unlockedAchievements,
             });
             
             const historyRef = collection(db, 'matchHistory');
             const newHistoryDoc = doc(historyRef); // Create a new doc with a generated ID
             batch.set(newHistoryDoc, {
                ...newMatchHistoryEntry,
                playerId: player.id
             });
             
             await batch.commit();
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
        comparisonResult: JSON.parse(JSON.stringify(result)) 
      };
      
      if (IS_FIREBASE_CONFIGURED) {
          await updateDoc(doc(db, 'battles', currentBattle.id), {
            status: 'completed',
            winnerId: winnerId || null,
            comparisonResult: JSON.parse(JSON.stringify(result)) 
          });
      } else {
          setBattleData(finalBattleState);
          setGameState('gameOver');
          await processGameEnd(finalBattleState);
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

    try {
        const battlesRef = collection(db, "battles");
        const waitingBattlesQuery = query(
            battlesRef,
            where("difficulty", "==", lobby.name),
            where("status", "==", "waiting"),
            limit(10)
        );

        const querySnapshot = await getDocs(waitingBattlesQuery);
        const availableBattleDoc = querySnapshot.docs.find(doc => doc.data().player1.id !== player.id);

        if (availableBattleDoc) {
            const battleDocRef = doc(db, 'battles', availableBattleDoc.id);
            try {
                await runTransaction(db, async (transaction) => {
                    const freshBattleDoc = await transaction.get(battleDocRef);
                    if (!freshBattleDoc.exists() || freshBattleDoc.data().status !== 'waiting') {
                        throw new Error("Battle is no longer available.");
                    }

                    const player2Data = {
                        id: player.id,
                        username: player.username,
                        avatarUrl: player.avatarUrl,
                        language: DEFAULT_LANGUAGE,
                        code: getCodePlaceholder(DEFAULT_LANGUAGE, freshBattleDoc.data().question),
                        hasSubmitted: false,
                    };

                    transaction.update(battleDocRef, {
                        player2: player2Data,
                        status: 'in-progress',
                        startedAt: serverTimestamp(),
                    });
                });
                setBattleId(availableBattleDoc.id);
                toast({ title: "Opponent Found!", description: "Joined a duel.", className: "bg-green-500 text-white" });
                return;
            } catch (e) {
                console.warn("Failed to join battle, it was likely taken. Will create a new one.", e);
            }
        }

        const question = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobby.name });
        if (!question.solution) throw new Error("AI failed to provide a valid solution.");

        const player1Data = {
            id: player.id,
            username: player.username,
            avatarUrl: player.avatarUrl,
            language: DEFAULT_LANGUAGE,
            code: getCodePlaceholder(DEFAULT_LANGUAGE, question),
            hasSubmitted: false,
        };

        const newBattleRef = await addDoc(collection(db, "battles"), {
            player1: player1Data,
            status: 'waiting',
            difficulty: lobby.name,
            wager: lobby.entryFee,
            question,
            createdAt: serverTimestamp(),
        });
        setBattleId(newBattleRef.id);
        toast({ title: "Lobby Created", description: "Waiting for an opponent to join your duel." });

    } catch (error) {
        console.error("Matchmaking error:", error);
        toast({ title: "Error Creating Match", description: "Could not find or create a match. Please try again.", variant: "destructive" });
        resetGameState(true);
    }
  }, [player, toast, resetGameState]);


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
              hasSubmitted: true 
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
      }
  }, [player, toast, resetGameState]);

  const handleSelectLobby = async (lobbyName: DifficultyLobby) => {
    if (!player) return;

    const lobbyInfo = LOBBIES.find(l => l.name === lobbyName);
    if (!lobbyInfo) return;

    if (player.coins < lobbyInfo.entryFee) {
        toast({ title: "Insufficient Coins", description: `You need ${lobbyInfo.entryFee} coins to enter.`, variant: "destructive", action: <ToastAction altText="Buy Coins" onClick={() => router.push('/buy-coins')}>Buy Coins</ToastAction> });
        return;
    }

    if (IS_FIREBASE_CONFIGURED) {
      try {
        const playerRef = doc(db, "players", player.id);
        await runTransaction(db, async (transaction) => {
          const playerDoc = await transaction.get(playerRef);
          if (!playerDoc.exists() || (playerDoc.data().coins || 0) < lobbyInfo.entryFee) {
            throw new Error("Insufficient coins.");
          }
          const newCoins = (playerDoc.data().coins || 0) - lobbyInfo.entryFee;
          transaction.update(playerRef, { coins: newCoins });
        });
        
        toast({ title: "Joining Lobby...", description: `${lobbyInfo.entryFee} coins deducted for entry. Good luck!`, className: "bg-primary text-primary-foreground" });
        await findOrCreateBattle(lobbyInfo);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Error Entering Lobby", description: `Failed to enter lobby: ${errorMessage}`, variant: "destructive" });
      }
    } else {
        startBotMatch(lobbyInfo);
    }
  };
  
  useEffect(() => {
    if (!battleId || !player || !IS_FIREBASE_CONFIGURED) return;

    const unsub = onSnapshot(doc(db, "battles", battleId), async (docSnap) => {
      
      if (!docSnap.exists()) {
        toast({ title: "Match Canceled", description: "The opponent left or the match was removed.", variant: "default" });
        resetGameState();
        return;
      }
      
      const newBattleData = { id: docSnap.id, ...docSnap.data() } as Battle;
      setBattleData(newBattleData);
      
      if (newBattleData.status === 'in-progress') {
        setGameState(currentState => {
            if (currentState === 'searching') {
                setTimeRemaining(LOBBIES.find(l => l.name === newBattleData.difficulty)!.baseTime * 60);
            }
            return 'inGame';
        });
      }
      
      if (newBattleData.status === 'completed' || newBattleData.status === 'forfeited') {
        setGameState(currentState => {
          if (currentState !== 'gameOver') {
            processGameEnd(newBattleData);
            return 'gameOver';
          }
          return currentState;
        });
      }

      if (newBattleData.status === 'comparing') {
        setGameState(currentState => {
          if (currentState !== 'submittingComparison' && currentState !== 'gameOver') {
            return 'submittingComparison';
          }
          return currentState;
        });
      }
      
      if (newBattleData.player1.hasSubmitted && newBattleData.player2?.hasSubmitted && newBattleData.status === 'in-progress') {
          if (player.id === newBattleData.player1.id) { 
              updateDoc(docSnap.ref, { status: 'comparing' });
              handleSubmissionFinalization(newBattleData);
          }
      }
    });

    return () => unsub();
  }, [battleId, player, handleSubmissionFinalization, processGameEnd, toast, resetGameState]);


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
            [`${playerKey}.language`]: language,
            [`${playerKey}.hasSubmitted`]: true
        };
        await updateDoc(doc(db, "battles", battleData.id), updatePayload);
    } else {
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        if (!playerKey || !battleData[playerKey]) return;

        const updatedBattle = {
            ...battleData,
            [playerKey]: {
                ...battleData[playerKey]!,
                code: code,
                language: language,
                hasSubmitted: true,
            }
        };
        setBattleData(updatedBattle);
        setGameState('submittingComparison');
        await handleSubmissionFinalization(updatedBattle);
    }
  };

  const handleTimeUp = async () => {
    if (!battleData || !player || battleData.status !== 'in-progress') return;
    
    if (IS_FIREBASE_CONFIGURED) {
        const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
        if (opponent?.hasSubmitted) {
            await updateDoc(doc(db, "battles", battleData.id), {
                status: 'forfeited',
                winnerId: opponent.id
            });
        } else {
            if(player.id === battleData.player1.id) {
               await updateDoc(doc(db, "battles", battleData.id), { status: 'completed', winnerId: null });
            }
        }
    } else {
        toast({ title: "Time's Up!", description: "You ran out of time and lost the duel.", variant: "destructive" });
        const finalBattleState = { ...battleData, status: 'forfeited' as const, winnerId: 'bot-player' };
        setBattleData(finalBattleState);
        await processGameEnd(finalBattleState);
        setGameState('gameOver');
    }
  };


  const handleLeaveConfirm = async () => {
    if (!player) return;
    setShowLeaveConfirm(false);

    const currentGameState = gameState; 
    
    if (currentGameState === 'searching' && selectedLobbyName) {
        if (IS_FIREBASE_CONFIGURED && battleId) {
            try {
                await runTransaction(db, async (transaction) => {
                    const battleDocRef = doc(db, 'battles', battleId);
                    const battleDocSnap = await transaction.get(battleDocRef);
                    if (battleDocSnap.exists() && battleDocSnap.data().player1.id === player.id && !battleDocSnap.data().player2) {
                        transaction.delete(battleDocRef);

                        const playerRef = doc(db, "players", player.id);
                        const lobby = LOBBIES.find(l => l.name === selectedLobbyName);
                        const playerSnap = await transaction.get(playerRef);
                         if (playerSnap.exists() && lobby) {
                            transaction.update(playerRef, { coins: playerSnap.data().coins + lobby.entryFee });
                        }
                    }
                });
                toast({ title: "Search Cancelled", description: `You left the lobby. Your entry fee has been refunded.`, variant: "default" });
            } catch (error) {
                console.error("Error cancelling search:", error);
            } finally {
                resetGameState(true);
            }
        } else {
             resetGameState(true);
        }
    } 
    else if (currentGameState === 'inGame' && battleData) {
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
            const finalBattleState = { ...battleData, status: 'forfeited' as const, winnerId: 'bot-player' };
            setBattleData(finalBattleState);
            await processGameEnd(finalBattleState);
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
        return `#include <iostream>\n#include <vector>\n#include <string>\n\nclass Solution {\npublic:\n  ${methodSignature}\n};\n`;
    }
    return `// Placeholder for ${selectedLang}.`;
  };

  useEffect(() => {
    if (battleData?.question && language) {
      const meInDb = battleData.player1.id === player?.id ? battleData.player1 : battleData.player2;
      
      if (meInDb?.code) {
        setCode(meInDb.code);
      } else {
        setCode(getCodePlaceholder(language, battleData.question));
      }

      if (meInDb?.language) {
          setLanguage(meInDb.language);
      }
    }
  }, [language, battleData, player]);


  const onLanguageChange = async (newLang: SupportedLanguage) => {
    if (!player || !battleData) return;
    setLanguage(newLang);
    const newCode = getCodePlaceholder(newLang, battleData.question);
    setCode(newCode);

    if (IS_FIREBASE_CONFIGURED && battleData.id && battleData.status !== 'waiting') {
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        // Ensure player2 exists before trying to update it.
        if (playerKey === 'player2' && !battleData.player2) return;

        await updateDoc(doc(db, 'battles', battleData.id), {
            [`${playerKey}.language`]: newLang,
            [`${playerKey}.code`]: newCode,
        });
    } else if (!IS_FIREBASE_CONFIGURED) {
        // Handle bot match case
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        if (!playerKey || !battleData[playerKey]) return;
        setBattleData(currentBattle => {
            if (!currentBattle) return null;
            return {
                ...currentBattle,
                [playerKey]: { 
                    ...currentBattle[playerKey]!, 
                    language: newLang,
                    code: newCode,
                }
            };
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

    
