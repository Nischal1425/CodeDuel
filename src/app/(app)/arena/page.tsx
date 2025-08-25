
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
import { db, rtdb } from '@/lib/firebase';
import { collection, doc, onSnapshot, updateDoc, serverTimestamp, writeBatch, runTransaction, setDoc, getDoc } from "firebase/firestore";
import { ref, onValue, remove, set, get, child, goOffline } from "firebase/database";


// Component Imports
import { LobbySelection } from './_components/LobbySelection';
import type { DifficultyLobby, LobbyInfo } from './_components/LobbySelection';
import { SearchingView } from './_components/SearchingView';
import { DuelView } from './_components/DuelView';
import { GameOverReport } from './_components/GameOverReport';


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!rtdb;

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
  
  const battleListenerUnsubscribe = useRef<() => void | undefined>();
  const queueListenerUnsubscribe = useRef<() => void | undefined>();
  const playerQueueRef = useRef<any>();


  const cleanupListeners = useCallback(() => {
    if (battleListenerUnsubscribe.current) {
        battleListenerUnsubscribe.current();
        battleListenerUnsubscribe.current = undefined;
    }
    if (queueListenerUnsubscribe.current) {
        queueListenerUnsubscribe.current();
        queueListenerUnsubscribe.current = undefined;
    }
    if (playerQueueRef.current) {
        remove(playerQueueRef.current);
        playerQueueRef.current = null;
    }
    if(rtdb) goOffline(rtdb);
  }, []);

  const resetGameState = useCallback((backToLobbySelection = true) => {
    cleanupListeners();
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
  }, [cleanupListeners]);

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

             batch.update(playerRef, {
                 matchesPlayed: finalPlayerStats.matchesPlayed,
                 wins: finalPlayerStats.wins,
                 losses: finalPlayerStats.losses,
                 winStreak: finalPlayerStats.winStreak,
                 unlockedAchievements: finalPlayerStats.unlockedAchievements,
             });
             
             if(outcome === 'win') {
                const winnings = Math.floor(battle.wager * 2 * (1 - COMMISSION_RATE));
                batch.update(playerRef, { coins: player.coins + winnings });
             } else if (outcome === 'draw') {
                batch.update(playerRef, { coins: player.coins + battle.wager });
             } // no change for loss as coins were already deducted

             const historyRef = collection(db, 'matchHistory');
             const newHistoryDoc = doc(historyRef); 
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
    setTimeout(() => sessionStorage.removeItem(hasProcessedKey), 5000); 
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


  const findMatch = useCallback(async (lobby: LobbyInfo) => {
    if (!player || !rtdb) return;

    const queuePath = `matchmakingQueue/${lobby.name}`;
    const queueRef = ref(rtdb, queuePath);
    playerQueueRef.current = child(queueRef, player.id);
    
    queueListenerUnsubscribe.current = onValue(queueRef, async (snapshot) => {
        const queue = snapshot.val();
        if (!queue) { // Queue is empty, add myself.
            set(playerQueueRef.current, { joinedAt: serverTimestamp(), rank: player.rank });
            return;
        }

        const playerIds = Object.keys(queue);
        const opponentId = playerIds.find(id => id !== player.id);

        if (opponentId) { // Found an opponent
            cleanupListeners(); // Stop listening to this queue
            
            const newBattleId = [player.id, opponentId].sort().join('_');
            const battleDocRef = doc(db, 'battles', newBattleId);

            try {
                await runTransaction(db, async (transaction) => {
                    const battleDoc = await transaction.get(battleDocRef);
                    if (battleDoc.exists()) {
                        return; // Battle already created by the other player
                    }

                    const question = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobby.name });
                    const opponentDoc = await getDoc(doc(db, 'players', opponentId));
                    if (!opponentDoc.exists()) throw new Error("Opponent not found");
                    const opponentData = opponentDoc.data() as Player;

                    const player1Data = {
                        id: player.id, username: player.username, avatarUrl: player.avatarUrl,
                        language: DEFAULT_LANGUAGE, code: getCodePlaceholder(DEFAULT_LANGUAGE, question), hasSubmitted: false
                    };
                    const player2Data = {
                        id: opponentId, username: opponentData.username, avatarUrl: opponentData.avatarUrl,
                        language: DEFAULT_LANGUAGE, code: getCodePlaceholder(DEFAULT_LANGUAGE, question), hasSubmitted: false
                    };
                    
                    const newBattle: Battle = {
                        id: newBattleId,
                        player1: player1Data,
                        player2: player2Data,
                        status: 'in-progress',
                        difficulty: lobby.name,
                        wager: lobby.entryFee,
                        question,
                        createdAt: serverTimestamp(),
                        startedAt: serverTimestamp(),
                    };
                    transaction.set(battleDocRef, newBattle);

                     // Clean up RTDB queue
                    const opponentQueueRef = child(queueRef, opponentId);
                    remove(opponentQueueRef);
                    remove(playerQueueRef.current);
                });
                setBattleId(newBattleId);
            } catch (error) {
                console.error("Match creation transaction failed:", error);
                resetGameState(true);
            }
        } else if (!playerIds.includes(player.id)) { // Opponent disappeared, re-add myself
             set(playerQueueRef.current, { joinedAt: serverTimestamp(), rank: player.rank });
        }
    }, (error) => {
        console.error("RTDB queue listener error:", error);
        toast({ title: "Matchmaking Error", description: "Lost connection to the queue.", variant: "destructive" });
        resetGameState(true);
    });

  }, [player, toast, cleanupListeners, resetGameState]);


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
    
    setGameState('searching');
    setSelectedLobbyName(lobbyName);

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
        await findMatch(lobbyInfo);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Error Entering Lobby", description: `Failed to enter lobby: ${errorMessage}`, variant: "destructive" });
        resetGameState(true);
      }
    } else {
        startBotMatch(lobbyInfo);
    }
  };
  
  useEffect(() => {
    if (!battleId || !player || !IS_FIREBASE_CONFIGURED) return;

    battleListenerUnsubscribe.current = onSnapshot(doc(db, "battles", battleId), async (docSnap) => {
      
      if (!docSnap.exists()) {
        setTimeout(() => {
          toast({ title: "Match Canceled", description: "The opponent left or the match was removed.", variant: "default" });
        }, 0);
        resetGameState();
        return;
      }
      
      const newBattleData = { id: docSnap.id, ...docSnap.data() } as Battle;
      setBattleData(newBattleData);
      
      if (newBattleData.status === 'in-progress') {
        setGameState(currentState => {
            if (currentState === 'searching') {
                const lobby = LOBBIES.find(l => l.name === newBattleData.difficulty);
                if (lobby) setTimeRemaining(lobby.baseTime * 60);
                setTimeout(() => {
                  toast({ title: "Opponent Found!", description: "Your duel is starting now!", className: "bg-green-500 text-white" });
                }, 0);
                return 'inGame';
            }
            return currentState;
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
              await updateDoc(docSnap.ref, { status: 'comparing' });
              await handleSubmissionFinalization(newBattleData);
          }
      }
    });

    return () => {
      if (battleListenerUnsubscribe.current) {
        battleListenerUnsubscribe.current();
      }
    };
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
        cleanupListeners();
        if (IS_FIREBASE_CONFIGURED) {
            try {
                const playerRef = doc(db, "players", player.id);
                const lobby = LOBBIES.find(l => l.name === selectedLobbyName);
                if (lobby) {
                    await runTransaction(db, async (transaction) => {
                        const playerSnap = await transaction.get(playerRef);
                        if (playerSnap.exists()) {
                            const currentCoins = playerSnap.data().coins || 0;
                            transaction.update(playerRef, { coins: currentCoins + lobby.entryFee });
                        }
                    });
                }
                toast({ title: "Search Cancelled", description: `You left the lobby. Your entry fee has been refunded.`, variant: "default" });
            } catch (error) {
                 console.error("Error refunding entry fee:", error);
            }
        }
        resetGameState(true);
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

  // Make sure to clean up any listeners on component unmount
  useEffect(() => {
    return () => cleanupListeners();
  }, [cleanupListeners]);


  const onLanguageChange = async (newLang: SupportedLanguage) => {
    if (!player || !battleData) return;
    setLanguage(newLang);
    const newCode = getCodePlaceholder(newLang, battleData.question);
    setCode(newCode);

    if (IS_FIREBASE_CONFIGURED && battleData.id && battleData.status !== 'waiting') {
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
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
