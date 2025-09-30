

"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UsersRound, Target, Zap, Sparkles, Users, Bot } from 'lucide-react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import { compareTeamSubmissions } from '@/ai/flows/compare-team-submissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import type { Player, MatchHistoryEntry, SupportedLanguage, Battle, TeamBattle, TeamLobby, TeamLobbyPlayer, GameMode } from '@/types';
import { ToastAction } from "@/components/ui/toast";
import { cn } from '@/lib/utils';
import { checkAchievementsOnMatchEnd } from '@/lib/achievement-logic';
import { db, rtdb } from '@/lib/firebase';
import { collection, doc, onSnapshot, updateDoc, serverTimestamp, writeBatch, runTransaction, setDoc, getDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { ref, onValue, remove, set, get, child, goOffline, goOnline, serverTimestamp as rtdbServerTimestamp, runTransaction as rtdbRunTransaction, update } from "firebase/database";
import { compareCodeSubmissions } from '@/ai/flows/compare-code-submissions';


// Component Imports
import { LobbySelection } from './_components/LobbySelection';
import type { DifficultyLobby, LobbyInfo } from './_components/LobbySelection';
import { SearchingView } from './_components/SearchingView';
import { CustomLobby } from './_components/CustomLobby';
import { TeamFormationLobby } from './_components/TeamFormationLobby';
import { DuelView } from './_components/DuelView';
import { TeamBattleView } from './_components/TeamBattleView';
import { GameOverReport } from './_components/GameOverReport';


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!rtdb;

const DEFAULT_LANGUAGE: SupportedLanguage = "javascript";
const COMMISSION_RATE = 0.05; // 5% commission

type GameState = 'selectingLobby' | 'searching' | 'inCustomLobby' | 'inTeamFormation' | 'inGame' | 'inTeamGame' | 'submittingComparison' | 'gameOver';

const LOBBIES: LobbyInfo[] = [
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 5, entryFee: 50, gameMode: '1v1' },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 10, entryFee: 100, gameMode: '1v1' },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 15, entryFee: 200, gameMode: '1v1' },
  { name: 'medium', title: 'Team DeathMatch', description: '4v4 tactical coding battle.', icon: Users, baseTime: 15, entryFee: 120, gameMode: '4v4' },
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
  const [customLobbyId, setCustomLobbyId] = useState<string | null>(null);
  const [battleData, setBattleData] = useState<Battle | null>(null);
  const [teamLobbyData, setTeamLobbyData] = useState<TeamLobby | null>(null);
  const [teamBattleData, setTeamBattleData] = useState<TeamBattle | null>(null);

  
  const battleListenerUnsubscribe = useRef<() => void | undefined>();
  const playerQueueRef = useRef<any>();
  const playerBattleListenerUnsubscribe = useRef<() => void | undefined>();
  const customLobbyListenerUnsubscribe = useRef<() => void | undefined>();


  const cleanupListeners = useCallback(() => {
    if (battleListenerUnsubscribe.current) {
        battleListenerUnsubscribe.current();
        battleListenerUnsubscribe.current = undefined;
    }
    if (playerQueueRef.current) {
        remove(playerQueueRef.current);
        playerQueueRef.current = null;
    }
     if (customLobbyListenerUnsubscribe.current) {
        customLobbyListenerUnsubscribe.current();
        customLobbyListenerUnsubscribe.current = undefined;
    }
    if (playerBattleListenerUnsubscribe.current) {
        playerBattleListenerUnsubscribe.current();
        playerBattleListenerUnsubscribe.current = undefined;
    }
    if (rtdb) {
        if(player?.id) remove(ref(rtdb, `playerBattles/${player.id}`));
        goOffline(rtdb);
    }
  }, [player?.id]);

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
    setCustomLobbyId(null);
    setBattleData(null);
    setTeamLobbyData(null);
    setTeamBattleData(null);
    hasInitializedCode.current = false;
  }, [cleanupListeners]);

  const showAchievementToast = useCallback((achievement) => {
    toast({
        title: <div className="flex items-center gap-2"><span className="font-semibold">Achievement Unlocked!</span></div>,
        description: <div><p className="font-medium text-lg">{achievement.name}</p>{achievement.reward && (<p className="mt-1 text-sm text-green-500 font-bold flex items-center gap-1">+ {achievement.reward.amount}</p>)}</div>,
        duration: 8000,
        className: "bg-accent text-accent-foreground border-yellow-400",
    });
  }, [toast]);
  

 const processGameEnd = useCallback(async (battle: Battle, teamBattleOutcome?: 'win' | 'loss' | 'draw') => {
    if (!player) return;
    
    const hasProcessedKey = `processed_match_${battle.id}`;
    if (sessionStorage.getItem(hasProcessedKey)) return;
    sessionStorage.setItem(hasProcessedKey, 'true');

    // If a team outcome is provided, use that for toasts and stats. Otherwise, use the 1v1 duel outcome.
    const finalOutcome = teamBattleOutcome ? teamBattleOutcome : (battle.winnerId === player.id ? 'win' : (!battle.winnerId ? 'draw' : 'loss'));

    let toastTitle = "Match Over";
    let toastDesc = "The match has concluded.";
    let toastVariant: "default" | "destructive" = "default";
    
    if (teamBattleOutcome) {
        toastTitle = finalOutcome === 'win' ? 'Team Victory!' : (finalOutcome === 'draw' ? 'Team Draw!' : 'Team Defeat');
        toastDesc = `Your team ${finalOutcome === 'win' ? 'was victorious' : (finalOutcome === 'draw' ? 'drew' : 'was defeated')} in the 4v4!`;
        if(finalOutcome === 'loss') toastVariant = 'destructive';
    } else {
         if (battle.status === 'forfeited') {
            if (battle.winnerId === player.id) {
                toastTitle="Victory by Forfeit!";
                toastDesc=`Your opponent forfeited.`;
            } else {
                toastTitle="You Forfeited";
                toastDesc=`You forfeited the match and lost your wager.`;
                toastVariant="destructive";
            }
        } else { // Completed
            if (finalOutcome === 'win') {
                toastTitle="Victory!";
                toastDesc=`You won the duel!`;
            } else if (finalOutcome === 'draw') {
                toastTitle="Draw!";
                toastDesc=`The duel ended in a draw. Your entry fee of ${battle.wager} coins was refunded.`;
            } else {
                toastTitle="Defeat";
                toastDesc="Your opponent's solution was deemed superior.";
                toastVariant="destructive";
            }
        }
    }


    const opponentInfo = player.id === battle.player1.id ? battle.player2 : battle.player1;
    const opponentRank = opponentInfo?.id === 'bot-player' ? player.rank : (opponentInfo ? 10 : player.rank);

    const achievementResult = checkAchievementsOnMatchEnd(player, { won: finalOutcome === 'win', opponentRank, lobbyDifficulty: battle.difficulty });
    
    const finalPlayerStats = achievementResult.updatedPlayer;

    const newMatchHistoryEntry: Omit<MatchHistoryEntry, 'id' | 'playerId'> = {
      matchId: battle.id,
      opponent: { username: opponentInfo?.username || 'Unknown', avatarUrl: opponentInfo?.avatarUrl },
      outcome: finalOutcome,
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
             
             if(finalOutcome === 'win') {
                const winnings = Math.floor(battle.wager * 2 * (1 - COMMISSION_RATE));
                batch.update(playerRef, { 'coins': finalPlayerStats.coins - battle.wager + winnings });
             } else if (finalOutcome === 'draw') {
                batch.update(playerRef, { 'coins': finalPlayerStats.coins });
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


 const handleTeamMatchCompletion = useCallback(async (completedBattle: Battle) => {
    if (!completedBattle.teamBattleId || !IS_FIREBASE_CONFIGURED || !player) return;

    const teamBattleRef = doc(db, "teamBattles", completedBattle.teamBattleId);
    
    try {
        const finalTeamBattleState = await runTransaction(db, async (transaction) => {
            const teamBattleSnap = await transaction.get(teamBattleRef);
            if (!teamBattleSnap.exists()) {
                // The teamBattle document might not have been created yet by the host.
                // This is fine, this player is not the host. Another player will handle it.
                return null;
            }
            if (teamBattleSnap.data().status === 'completed') {
                return teamBattleSnap.data() as TeamBattle;
            }
            
            let teamBattleDoc = teamBattleSnap.data() as TeamBattle;

            // Atomically increment finishedDuels count
            const newFinishedCount = (teamBattleDoc.finishedDuels || 0) + 1;
            transaction.update(teamBattleRef, { finishedDuels: newFinishedCount });
            teamBattleDoc.finishedDuels = newFinishedCount;

            const allDuelsFinished = newFinishedCount === 4;

            if (allDuelsFinished) {
                
                const battlesQuery = query(collection(db, 'battles'), where("teamBattleId", "==", completedBattle.teamBattleId));
                const battlesSnapshot = await getDocs(battlesQuery);
                const allTeamBattles = battlesSnapshot.docs.map(d => d.data() as Battle);

                // Helper to get the correct player object from the battle doc
                const getPlayerFromBattle = (battleDoc: Battle, playerId: string) => {
                    return battleDoc.player1.id === playerId ? battleDoc.player1 : battleDoc.player2;
                }

                const team1Players = teamBattleDoc.team1.map(p => {
                    const battleForPlayer = allTeamBattles.find(b => b.player1.id === p.id || b.player2?.id === p.id);
                    const playerData = battleForPlayer ? getPlayerFromBattle(battleForPlayer, p.id) : null;
                    return {...p, hasSubmitted: true, code: playerData?.code || '', language: playerData?.language || DEFAULT_LANGUAGE};
                });
                const team2Players = teamBattleDoc.team2.map(p => {
                    const battleForPlayer = allTeamBattles.find(b => b.player1.id === p.id || b.player2?.id === p.id);
                    const playerData = battleForPlayer ? getPlayerFromBattle(battleForPlayer, p.id) : null;
                    return {...p, hasSubmitted: true, code: playerData?.code || '', language: playerData?.language || DEFAULT_LANGUAGE};
                });
                
                const comparisonInput = {
                    team1: team1Players,
                    team2: team2Players,
                    question: allTeamBattles[0].question,
                };
                
                const result = await compareTeamSubmissions(comparisonInput);
                
                const updatedTeamBattle = {
                    ...teamBattleDoc,
                    ...result,
                    status: 'completed' as const,
                };
                transaction.set(teamBattleRef, updatedTeamBattle);
                return updatedTeamBattle;
            }
             return teamBattleDoc;
        });

        if (finalTeamBattleState && finalTeamBattleState.status === 'completed') {
            const playerTeam = finalTeamBattleState.team1.some(p => p.id === player.id) ? 'team1' : 'team2';
            const teamOutcome = finalTeamBattleState.winnerTeam === 'draw' ? 'draw' : (finalTeamBattleState.winnerTeam === playerTeam ? 'win' : 'loss');
            setTeamBattleData(finalTeamBattleState);
            const playerBattle = (await getDoc(doc(db, 'battles', battleId!))).data() as Battle;
            await processGameEnd(playerBattle, teamOutcome);
        }

    } catch (e) {
        console.error("Error finalizing team battle:", e);
    }
}, [player, processGameEnd, battleId]);


 const handleSubmissionFinalization = useCallback(async (currentBattle: Battle) => {
    if (!player || (!currentBattle.player2 && IS_FIREBASE_CONFIGURED)) {
      toast({ title: "Error", description: "Critical battle data missing.", variant: "destructive" });
      return;
    }
    
    // In team battles, individual duel outcomes are determined, but the game end for the player is handled by `handleTeamMatchCompletion`
    if (currentBattle.teamBattleId && IS_FIREBASE_CONFIGURED) {
         // The individual duel is over, let the listener trigger the team match completion logic
         await updateDoc(doc(db, 'battles', currentBattle.id), { status: 'completed' });
         return;
    }
    
    // Standard 1v1 duel logic
    try {
      const submissionInput = {
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
    goOnline(rtdb);

    const lobbyQueueRef = ref(rtdb, `matchmakingQueue/${lobby.name}`);
    
    // Set up a listener for my battle ID before I enter the queue
    const playerBattleRef = ref(rtdb, `playerBattles/${player.id}`);
    playerBattleListenerUnsubscribe.current = onValue(playerBattleRef, (snapshot) => {
        const newBattleId = snapshot.val();
        if (newBattleId) {
            setBattleId(newBattleId);
            remove(playerBattleRef); // Clean up temp node
            if (playerQueueRef.current) {
                remove(playerQueueRef.current); // Clean up my queue entry if I was the one who created the match
            }
        }
    });

    rtdbRunTransaction(lobbyQueueRef, (queue) => {
      if (queue === null) {
        queue = {};
      }

      // Check for an opponent. Find someone who is not the current player.
      const opponentId = Object.keys(queue).find(id => id !== player.id);
      
      if (opponentId) {
        // --- Opponent Found ---
        const opponentDataFromQueue = queue[opponentId];
        delete queue[opponentId];
        
        (async () => {
          try {
            const newBattleId = [player.id, opponentId].sort().join('_') + `_${Date.now()}`;
            const battleDocRef = doc(db, 'battles', newBattleId);

            const opponentDoc = await getDoc(doc(db, 'players', opponentId));
            if (!opponentDoc.exists()) throw new Error("Opponent data not found in Firestore.");
            const opponentData = opponentDoc.data() as Player;

            const question = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobby.name });
            
            const player1IsMe = player.id < opponentId;
            const player1FirebaseData = {
              id: player1IsMe ? player.id : opponentId, 
              username: player1IsMe ? player.username : opponentData.username, 
              avatarUrl: player1IsMe ? player.avatarUrl : opponentData.avatarUrl,
              language: DEFAULT_LANGUAGE, 
              code: getCodePlaceholder(DEFAULT_LANGUAGE, question), 
              hasSubmitted: false
            };
            const player2FirebaseData = {
              id: player1IsMe ? opponentId : player.id,
              username: player1IsMe ? opponentData.username : player.username, 
              avatarUrl: player1IsMe ? opponentData.avatarUrl : player.avatarUrl,
              language: DEFAULT_LANGUAGE, 
              code: getCodePlaceholder(DEFAULT_LANGUAGE, question), 
              hasSubmitted: false
            };

            const newBattle: Battle = {
              id: newBattleId,
              player1: player1FirebaseData,
              player2: player2FirebaseData,
              status: 'in-progress',
              difficulty: lobby.name,
              wager: lobby.entryFee,
              question,
              createdAt: serverTimestamp(),
              startedAt: serverTimestamp(),
            };

            await setDoc(battleDocRef, newBattle);
            
            await set(ref(rtdb, `playerBattles/${player.id}`), newBattleId);
            await set(ref(rtdb, `playerBattles/${opponentId}`), newBattleId);

          } catch (e) {
            console.error("Failed to create battle:", e);
            toast({ title: "Match Creation Error", description: "Could not create the match.", variant: "destructive" });
            resetGameState(true);
          }
        })();

        return queue; 
      } else {
        // --- No Opponent Found ---
        if (!queue[player.id]) {
            queue[player.id] = { joinedAt: rtdbServerTimestamp(), rank: player.rank };
            playerQueueRef.current = child(lobbyQueueRef, player.id);
        }
        return queue;
      }
    });
  }, [player, toast, resetGameState]);

  const handleLobby1v1Action = (lobby: LobbyInfo) => {
    if (!player) {
      toast({ title: "Not Logged In", description: "You must be logged in to play.", variant: "destructive" });
      return;
    }
    if (player.coins < lobby.entryFee) {
      toast({
        title: "Insufficient Coins",
        description: `You need ${lobby.entryFee} coins to enter the ${lobby.title} lobby.`,
        variant: "destructive",
        action: <ToastAction altText="Buy Coins" onClick={() => router.push('/buy-coins')}>Buy Coins</ToastAction>,
      });
      return;
    }

    const startAction = async () => {
      try {
        if (IS_FIREBASE_CONFIGURED) {
          const playerRef = doc(db, "players", player.id);
          await runTransaction(db, async (transaction) => {
            const playerSnap = await transaction.get(playerRef);
            if (!playerSnap.exists() || playerSnap.data().coins < lobby.entryFee) {
              throw new Error("Insufficient coins.");
            }
            const newCoins = playerSnap.data().coins - lobby.entryFee;
            transaction.update(playerRef, { coins: newCoins });
          });
        }
        
        setSelectedLobbyName(lobby.name);
        setGameState('searching');

        if (IS_FIREBASE_CONFIGURED) {
          await findMatch(lobby);
        } else {
          startBotMatch(lobby);
        }
      } catch (error) {
        console.error("1v1 lobby action failed: ", error);
        toast({
          title: "Lobby Entry Failed",
          description: (error as Error).message === "Insufficient coins." ? "You don't have enough coins." : "Could not enter lobby.",
          variant: "destructive",
        });
      }
    };
    startAction();
  };

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

  const startTeamBattle = useCallback(async (lobbyName: DifficultyLobby, finalLobbyData: TeamLobby) => {
    if (!player || !rtdb || !IS_FIREBASE_CONFIGURED || !customLobbyId) return;

    try {
        const lobby = LOBBIES.find(l => l.name === lobbyName && l.gameMode === '4v4');
        if (!lobby) throw new Error("Lobby configuration not found.");

        await set(ref(rtdb, `customLobbies/${customLobbyId}/status`), 'starting');

        const [q1, q2, q3, q4] = await Promise.all([
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
        ]);

        const team1 = Object.values(finalLobbyData.teams.blue).filter((p): p is TeamLobbyPlayer => p !== null);
        const team2 = Object.values(finalLobbyData.teams.red).filter((p): p is TeamLobbyPlayer => p !== null);
        const questions = [q1, q2, q3, q4];
        
        const teamBattleId = `team-battle-${Date.now()}`;
        
        const batch = writeBatch(db);
        
        const teamBattleRef = doc(db, "teamBattles", teamBattleId);
        batch.set(teamBattleRef, {
            id: teamBattleId,
            team1: team1.map(p => ({...p, code: '', hasSubmitted: false, language: DEFAULT_LANGUAGE})),
            team2: team2.map(p => ({...p, code: '', hasSubmitted: false, language: DEFAULT_LANGUAGE})),
            team1Score: 0,
            team2Score: 0,
            status: 'in-progress',
            difficulty: lobbyName,
            createdAt: serverTimestamp(),
            finishedDuels: 0,
            winnerTeam: null
        });

        const rtdbUpdates: { [key: string]: any } = {};

        for (let i = 0; i < 4; i++) {
            const p1 = team1[i];
            const p2 = team2[i];
            const question = questions[i];
            if (!p1 || !p2) continue;

            const isBot1 = p1.id.startsWith('bot_');
            const isBot2 = p2.id.startsWith('bot_');
            
            const battleId = `${teamBattleId}_slot${i+1}`;
            const battleDocRef = doc(db, 'battles', battleId);

            const newBattle: Battle = {
                id: battleId,
                teamBattleId: teamBattleId,
                player1: { id: p1.id, username: p1.username, avatarUrl: p1.avatarUrl, language: DEFAULT_LANGUAGE, code: getCodePlaceholder(DEFAULT_LANGUAGE, question), hasSubmitted: isBot1, ...(isBot1 && {code: question.solution}) },
                player2: { id: p2.id, username: p2.username, avatarUrl: p2.avatarUrl, language: DEFAULT_LANGUAGE, code: getCodePlaceholder(DEFAULT_LANGUAGE, question), hasSubmitted: isBot2, ...(isBot2 && {code: question.solution}) },
                status: 'in-progress',
                difficulty: lobbyName,
                wager: lobby.entryFee,
                question,
                createdAt: serverTimestamp(),
                startedAt: serverTimestamp(),
            };
            batch.set(battleDocRef, newBattle);
            
            rtdbUpdates[`/playerBattles/${p1.id}`] = battleId;
            rtdbUpdates[`/playerBattles/${p2.id}`] = battleId;
        }

        await batch.commit();
        rtdbUpdates[`/customLobbies/${customLobbyId}`] = null;
        await update(ref(rtdb), rtdbUpdates);

    } catch (error) {
        console.error("Error starting team battle:", error);
        toast({ title: 'Error', description: 'Could not start the team battle.', variant: 'destructive' });
        if(customLobbyId) await set(ref(rtdb, `customLobbies/${customLobbyId}/status`), 'waiting');
    }
  }, [player, toast, customLobbyId]);

  const setupTeamLobbyListener = useCallback((lobbyId: string, isPublicMatch: boolean = false) => {
    if (!rtdb || !player) return;
    const lobbyRef = ref(rtdb, `customLobbies/${lobbyId}`);
    
    customLobbyListenerUnsubscribe.current = onValue(lobbyRef, (snapshot) => {
        if (!snapshot.exists()) {
             if (gameState !== 'selectingLobby' && gameState !== 'inGame' && gameState !== 'inTeamGame') {
                 toast({ title: "Lobby Closed", description: "The host has closed the lobby or the game has started." });
                 resetGameState(true);
             }
             return;
        }
        const data = snapshot.val() as TeamLobby;
        
        // This is a crucial addition to handle initial data load correctly.
        setTeamLobbyData(data);
        
        if (isPublicMatch) {
            setGameState('inTeamFormation');
        } else {
            setGameState('inCustomLobby');
        }

        if (!data.teams || !data.teams.blue || !data.teams.red) {
            return; 
        }

        const allPlayers = [...Object.values(data.teams.blue), ...Object.values(data.teams.red)].filter(p => p !== null);
        if (data.status === 'forming' && allPlayers.length === 8) {
            if (data.hostId === player.id) { // Only host starts the battle
                startTeamBattle(selectedLobbyName || 'medium', data);
            }
        }

        if (data.status === 'starting') {
            const playerBattleRef = ref(rtdb, `playerBattles/${player.id}`);
            playerBattleListenerUnsubscribe.current = onValue(playerBattleRef, (battleSnap) => {
                const newBattleId = battleSnap.val();
                if (newBattleId) {
                    setBattleId(newBattleId);
                    remove(playerBattleRef);
                }
            });
        }
    });

  }, [resetGameState, toast, player, gameState, selectedLobbyName, startTeamBattle]);

  const handleCreateCustomLobby = async (lobbyName: DifficultyLobby) => {
    if (!player || !rtdb) return;
  
    const lobby = LOBBIES.find(l => l.name === lobbyName && l.gameMode === '4v4');
    if (!lobby) return;
    if (player.coins < lobby.entryFee) {
        toast({ title: "Insufficient Coins", description: "You don't have enough coins for this.", variant: "destructive" });
        return;
    }
  
    try {
        if (IS_FIREBASE_CONFIGURED) {
            const playerRef = doc(db, "players", player.id);
            await runTransaction(db, async (transaction) => {
                const playerSnap = await transaction.get(playerRef);
                if (!playerSnap.exists() || playerSnap.data().coins < lobby.entryFee) throw new Error("Insufficient coins.");
                transaction.update(playerRef, { coins: playerSnap.data().coins - lobby.entryFee });
            });
        }
        
        const lobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const hostPlayer: TeamLobbyPlayer = {
          id: player.id,
          username: player.username,
          rating: player.rating,
          avatarUrl: player.avatarUrl,
        };

        const newLobby: TeamLobby = {
            id: lobbyCode,
            hostId: player.id,
            isPublic: false,
            status: 'waiting',
            teams: {
                blue: { '1': hostPlayer, '2': null, '3': null, '4': null },
                red: { '1': null, '2': null, '3': null, '4': null },
            }
        };
        
        const lobbyRef = ref(rtdb, `customLobbies/${lobbyCode}`);
        await set(lobbyRef, newLobby);
        
        setCustomLobbyId(lobbyCode);
        setSelectedLobbyName(lobbyName);
        setupTeamLobbyListener(lobbyCode);
        setGameState('inCustomLobby');
  
    } catch (e) {
        console.error("Error creating custom lobby:", e);
        toast({ title: "Error", description: "Could not create lobby.", variant: "destructive"});
    }
  };

   const handleFindPublicTeamMatch = useCallback(async (lobbyName: DifficultyLobby) => {
    if (!player || !rtdb) return;

    const lobby = LOBBIES.find(l => l.name === lobbyName && l.gameMode === '4v4');
    if (!lobby) return;
    if (player.coins < lobby.entryFee) {
        toast({ title: "Insufficient Coins", description: "You don't have enough coins.", variant: "destructive" });
        return;
    }
    
    try {
        if (IS_FIREBASE_CONFIGURED) {
            const playerRef = doc(db, "players", player.id);
            await runTransaction(db, async (transaction) => {
                const playerSnap = await transaction.get(playerRef);
                if (!playerSnap.exists() || playerSnap.data().coins < lobby.entryFee) throw new Error("Insufficient coins.");
                transaction.update(playerRef, { coins: playerSnap.data().coins - lobby.entryFee });
            });
        }

        goOnline(rtdb);
        setSelectedLobbyName(lobbyName);
        setGameState('searching');

        const teamQueueRef = ref(rtdb, `teamMatchmakingQueue/${lobbyName}`);
        
        const publicLobbiesRef = query(collection(db, 'customLobbies'), where('isPublic', '==', true), where('status', '==', 'waiting'));
        const publicLobbiesSnap = await getDocs(publicLobbiesRef as any);

        for (const lobbyDoc of publicLobbiesSnap.docs) {
            const lobbyData = lobbyDoc.data() as TeamLobby;
            const allPlayers = [...Object.values(lobbyData.teams.blue || {}), ...Object.values(lobbyData.teams.red || {})].filter(p => p);
            if (allPlayers.length < 8) {
                for (const team of ['blue', 'red'] as const) {
                    for (const slot of ['1', '2', '3', '4'] as const) {
                        if (!lobbyData.teams[team][slot]) {
                            await handleJoinTeam(team, slot, lobbyDoc.id);
                            return;
                        }
                    }
                }
            }
        }

        const playerLobbyRef = ref(rtdb, `playerLobbies/${player.id}`);
        const unsubscribePlayerLobby = onValue(playerLobbyRef, (snapshot) => {
            const lobbyId = snapshot.val();
            if (lobbyId) {
                unsubscribePlayerLobby();
                remove(playerLobbyRef);
                setCustomLobbyId(lobbyId);
                setupTeamLobbyListener(lobbyId, true);
            }
        });

        rtdbRunTransaction(teamQueueRef, (queue) => {
            if (queue === null) queue = {};
            
            queue[player.id] = { id: player.id, username: player.username, avatarUrl: player.avatarUrl, rating: player.rating, joinedAt: rtdbServerTimestamp() };

            if (Object.keys(queue).length >= 8) {
                const players = Object.values(queue).slice(0, 8);
                players.forEach((p: any) => delete queue[p.id]);

                (async () => {
                    const teamLobbyId = `team-lobby-${Date.now()}`;
                    const newLobbyRef = ref(rtdb, `customLobbies/${teamLobbyId}`);
                    const playersData = (players as TeamLobbyPlayer[]).sort((a, b) => a.rating - b.rating);

                    const newLobby: TeamLobby = {
                        id: teamLobbyId,
                        hostId: playersData[0].id,
                        isPublic: true,
                        status: 'forming',
                        teams: {
                            blue: { '1': playersData[0], '2': playersData[2], '3': playersData[4], '4': playersData[6] },
                            red: { '1': playersData[1], '2': playersData[3], '3': playersData[5], '4': playersData[7] }
                        }
                    };

                    await set(newLobbyRef, newLobby);

                    const playerLobbyUpdates: { [key: string]: string } = {};
                    playersData.forEach(p => { playerLobbyUpdates[`/playerLobbies/${p.id}`] = teamLobbyId; });
                    await update(ref(rtdb), playerLobbyUpdates);
                })();
            }
            playerQueueRef.current = child(teamQueueRef, player.id);
            return queue;
        });

    } catch(e) {
      toast({ title: "Error", description: "Could not find a public match.", variant: "destructive" });
    }
  }, [player, setupTeamLobbyListener, toast]);
  
  const handleJoinCustomLobby = async (lobbyCode: string, lobbyName: DifficultyLobby) => {
     if (!player || !rtdb || !lobbyCode) return;

     const lobby = LOBBIES.find(l => l.name === lobbyName && l.gameMode === '4v4');
     if (!lobby) return;
     if (player.coins < lobby.entryFee) {
        toast({ title: "Insufficient Coins", description: "You don't have enough coins.", variant: "destructive" });
        return;
     }

     const lobbyRef = ref(rtdb, `customLobbies/${lobbyCode}`);
     const snapshot = await get(lobbyRef);
     if (snapshot.exists()) {
         try {
            if (IS_FIREBASE_CONFIGURED) {
                const playerRef = doc(db, "players", player.id);
                await runTransaction(db, async (transaction) => {
                    const playerSnap = await transaction.get(playerRef);
                    if (!playerSnap.exists() || playerSnap.data().coins < lobby.entryFee) throw new Error("Insufficient coins.");
                    transaction.update(playerRef, { coins: playerSnap.data().coins - lobby.entryFee });
                });
            }
            setSelectedLobbyName(lobbyName);
            setupTeamLobbyListener(lobbyCode);
            setCustomLobbyId(lobbyCode);
            setGameState('inCustomLobby');
         } catch (e) {
             toast({ title: 'Error', description: 'Could not join lobby.', variant: 'destructive'});
         }
     } else {
         toast({ title: 'Not Found', description: 'Lobby code is invalid or has expired.', variant: 'destructive'});
     }
  };
  
  const handleJoinTeam = async (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4', lobbyId?: string) => {
      if (!player || !rtdb) return;
      const id = lobbyId || customLobbyId;
      if (!id) {
        toast({ title: "Error", description: "Lobby ID not found.", variant: "destructive"});
        return;
      }
      
      const slotRef = ref(rtdb, `customLobbies/${id}/teams/${team}/${slot}`);
      
      const newPlayerInSlot: TeamLobbyPlayer = {
          id: player.id,
          username: player.username,
          rating: player.rating,
          avatarUrl: player.avatarUrl,
      };

      try {
        await set(slotRef, newPlayerInSlot);
        setCustomLobbyId(id);
        setupTeamLobbyListener(id);
      } catch (error) {
        console.error("Failed to join team slot", error);
        toast({ title: "Error", description: "Could not join the team.", variant: "destructive"});
      }
  };

  const handleToggleLock = async () => {
    if (!customLobbyId || !rtdb || !teamLobbyData || player?.id !== teamLobbyData.hostId) return;
    const lockRef = ref(rtdb, `customLobbies/${customLobbyId}/isPublic`);
    await set(lockRef, !teamLobbyData.isPublic);
  };
  
  const handleLeaveCustomLobby = async () => {
    if (!player || !customLobbyId || !rtdb) return;

    if (customLobbyListenerUnsubscribe.current) {
        customLobbyListenerUnsubscribe.current();
        customLobbyListenerUnsubscribe.current = undefined;
    }

    if (teamLobbyData?.hostId === player.id) {
        await remove(ref(rtdb, `customLobbies/${customLobbyId}`));
    } else {
        if(teamLobbyData?.teams) {
            for (const team of ['blue', 'red'] as const) {
                for (const slot of ['1', '2', '3', '4'] as const) {
                    const currentPlayer = teamLobbyData?.teams?.[team]?.[slot];
                    if (currentPlayer?.id === player.id) {
                        await set(ref(rtdb, `customLobbies/${customLobbyId}/teams/${team}/${slot}`), null);
                        break;
                    }
                }
            }
        }
    }
    
    resetGameState(true);
  };

 const handleFillWithBots = async () => {
    if (!player || !customLobbyId || !teamLobbyData || teamLobbyData.hostId !== player.id || !rtdb) return;

    const botNames = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india"];
    let botIndex = 0;

    const lobbyRef = ref(rtdb, `customLobbies/${customLobbyId}`);
    
    const transactionResult = await rtdbRunTransaction(lobbyRef, (currentLobbyData: TeamLobby) => {
        if (!currentLobbyData) return currentLobbyData;

        // Ensure teams object exists
        if (!currentLobbyData.teams) {
          currentLobbyData.teams = {
            blue: { '1': null, '2': null, '3': null, '4': null },
            red: { '1': null, '2': null, '3': null, '4': null },
          };
        }

        for (const team of ['blue', 'red'] as const) {
            for (const slot of ['1', '2', '3', '4'] as const) {
                if (!currentLobbyData.teams[team][slot]) {
                    const botName = botNames[botIndex % botNames.length];
                    const botId = `bot_${botName}_${Math.random().toString(36).substring(2, 7)}`;
                    currentLobbyData.teams[team][slot] = {
                        id: botId,
                        username: `Bot ${botName.charAt(0).toUpperCase() + botName.slice(1)}`,
                        rating: 1000 + Math.floor(Math.random() * 500),
                        avatarUrl: ''
                    };
                    botIndex++;
                }
            }
        }
        return currentLobbyData;
    });
  };

  useEffect(() => {
    if (!battleId || !player || !IS_FIREBASE_CONFIGURED) return;

    const newBattleDocRef = doc(db, "battles", battleId);

    battleListenerUnsubscribe.current = onSnapshot(newBattleDocRef, async (docSnap) => {
      
      if (!docSnap.exists()) {
         if (gameState !== 'searching' && gameState !== 'selectingLobby') { 
             setTimeout(() => {
               toast({ title: "Match Canceled", description: "The opponent left or the match was removed.", variant: "default" });
             }, 0);
             resetGameState();
         }
        return;
      }
      
      const newBattleData = { id: docSnap.id, ...docSnap.data() } as Battle;
      setBattleData(newBattleData);
      
      const wasSearchingOrInLobby = gameState === 'searching' || gameState === 'inCustomLobby' || gameState === 'inTeamFormation';

      if (newBattleData.status === 'in-progress') {
        setGameState(currentState => {
            if (wasSearchingOrInLobby) {
                const lobby = LOBBIES.find(l => l.name === newBattleData.difficulty);
                if (lobby) setTimeRemaining(lobby.baseTime * 60);
                setTimeout(() => {
                  toast({ title: "Match Starting!", description: "Your duel is starting now!", className: "bg-green-500 text-white" });
                }, 0);
                 if (newBattleData.teamBattleId) {
                    const teamBattleRef = doc(db, "teamBattles", newBattleData.teamBattleId);
                    onSnapshot(teamBattleRef, (teamSnap) => {
                        if (teamSnap.exists()) {
                            const tbData = teamSnap.data() as TeamBattle;
                            setTeamBattleData(tbData);
                             if (tbData.status === 'completed') {
                                setGameState('gameOver');
                            }
                        }
                    });
                }
                return newBattleData.teamBattleId ? 'inTeamGame' : 'inGame';
            }
            return currentState;
        });
      }
      
      if ((newBattleData.status === 'completed' || newBattleData.status === 'forfeited')) {
        setGameState(currentState => {
          if (currentState !== 'gameOver') {
            if (newBattleData.teamBattleId) {
                handleTeamMatchCompletion(newBattleData);
            } else {
                processGameEnd(newBattleData);
            }
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
      
      const me = newBattleData.player1.id === player.id ? newBattleData.player1 : newBattleData.player2;

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
  }, [battleId, player, handleSubmissionFinalization, processGameEnd, toast, resetGameState, gameState, handleTeamMatchCompletion]);


  const handleSubmitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim() || !player) return;

    const currentBattle = battleData; // 1v1 or the individual duel from a 4v4
    if (!currentBattle) return;

    const me = currentBattle.player1.id === player.id ? currentBattle.player1 : currentBattle.player2;
    if (me?.hasSubmitted) return;
    toast({ title: "Code Submitted!", description: "Your solution is locked in.", className: "bg-primary text-primary-foreground" });
    const playerKey = currentBattle.player1.id === player.id ? 'player1' : 'player2';

    if (IS_FIREBASE_CONFIGURED) {
        await updateDoc(doc(db, "battles", currentBattle.id), { [`${playerKey}.code`]: code, [`${playerKey}.language`]: language, [`${playerKey}.hasSubmitted`]: true });
    } else { // Offline bot mode
        const finalBattleState: Battle = { ...currentBattle, [playerKey]: { ...currentBattle[playerKey]!, code: code, language: language, hasSubmitted: true }, player2: { ...currentBattle.player2!, hasSubmitted: true } };
        setBattleData(finalBattleState);
        setGameState('submittingComparison');
        await handleSubmissionFinalization(finalBattleState);
    }
  };

  const handleTimeUp = async () => {
    if (!player) return;
    
    if ((gameState === 'inGame' || gameState === 'inTeamGame') && battleData && battleData.status === 'in-progress') {
        const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
        if (!opponent) return; 

        toast({ title: "Time's Up!", description: "You ran out of time.", variant: "destructive" });

        if (IS_FIREBASE_CONFIGURED) {
            if (battleData.teamBattleId) {
                // In team mode, just submit empty code. No automatic forfeit.
                await handleSubmitCode();
            } else {
                await updateDoc(doc(db, "battles", battleData.id), { status: 'forfeited', winnerId: opponent.id });
            }
        } else {
            const finalBattleState = { ...battleData, status: 'forfeited' as const, winnerId: 'bot-player' };
            setBattleData(finalBattleState);
await processGameEnd(finalBattleState);
            setGameState('gameOver');
        }
    }
  };


  const handleLeaveConfirm = async () => {
    if (!player) return;
    setShowLeaveConfirm(false);

    const currentGameState = gameState; 
    
    const refundCoins = async () => {
        if (IS_FIREBASE_CONFIGURED && selectedLobbyName) {
            try {
                const lobby = LOBBIES.find(l => l.name === selectedLobbyName);
                if (lobby) {
                     const playerRef = doc(db, "players", player.id);
                     await runTransaction(db, async (transaction) => {
                        const playerSnap = await transaction.get(playerRef);
                        if (playerSnap.exists()) {
                            const currentCoins = playerSnap.data().coins || 0;
                            transaction.update(playerRef, { coins: currentCoins + lobby.entryFee });
                        }
                    });
                    toast({ title: "Fee Refunded", description: `Your entry fee of ${lobby.entryFee} has been returned.`, variant: "default" });
                }
            } catch(error) {
                console.error("Error refunding coins:", error);
                toast({ title: "Refund Error", description: "Could not refund your entry fee.", variant: "destructive" });
            }
        }
    };
    
    if (currentGameState === 'searching' || currentGameState === 'inTeamFormation') {
        cleanupListeners();
        await refundCoins();
        resetGameState(true);
    } 
    else if ((currentGameState === 'inGame' || currentGameState === 'inTeamGame') && battleData) {
        if (IS_FIREBASE_CONFIGURED) {
             if (battleData.teamBattleId) {
                 toast({ title: "Match Forfeited", description: "You have forfeited your duel. This will count as a loss for you." });
                 await handleSubmitCode(); // Submit empty code to mark as complete
             } else {
                const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
                if (opponent) {
                     await updateDoc(doc(db, 'battles', battleData.id), { status: 'forfeited', winnerId: opponent.id });
                } else { 
                     resetGameState(true);
                }
             }
        } else { // Offline bot mode
            const finalBattleState = { ...battleData, status: 'forfeited' as const, winnerId: 'bot-player' };
            setBattleData(finalBattleState);
            await processGameEnd(finalBattleState);
            setGameState('gameOver');
        }
    } else if (currentGameState === 'inCustomLobby') {
        handleLeaveCustomLobby();
        await refundCoins();
    } else if (currentGameState === 'inTeamGame') {
        toast({ title: "Match Left", description: "You have left the team battle." });
        resetGameState(true);
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

  const hasInitializedCode = useRef(false);

  useEffect(() => {
    const currentBattle = battleData; // This is always the 1v1 duel view
    if (currentBattle?.question && player && !hasInitializedCode.current) {
        const question = currentBattle.question;
        
        const meInDb = currentBattle.player1?.id === player.id ? currentBattle.player1 : currentBattle.player2;
        let initialCode = getCodePlaceholder(meInDb?.language || DEFAULT_LANGUAGE, question);
        let initialLanguage = meInDb?.language || DEFAULT_LANGUAGE;

        if (meInDb && !meInDb.hasSubmitted) {
            initialCode = meInDb.code || initialCode;
            initialLanguage = meInDb.language || initialLanguage;
        }

        setCode(initialCode);
        setLanguage(initialLanguage);
        hasInitializedCode.current = true;
    }
  }, [battleData, player, language]);


  useEffect(() => {
    return () => {
        cleanupListeners();
    }
  }, [cleanupListeners]);


  const onLanguageChange = async (newLang: SupportedLanguage) => {
    if (!player) return;
    const question = battleData?.question;
    const newCode = getCodePlaceholder(newLang, question);
    setCode(newCode);
    setLanguage(newLang);

    if (IS_FIREBASE_CONFIGURED && battleData?.id && battleData.status !== 'waiting') {
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';
        if (playerKey === 'player2' && !battleData.player2) return;

        await updateDoc(doc(db, 'battles', battleData.id), {
            [`${playerKey}.language`]: newLang,
            [`${playerKey}.code`]: newCode,
        });
    }
  }
  
  const handleFindNewMatch = () => {
    resetGameState(true);
  };


  const renderContent = () => {
    switch (gameState) {
        case 'selectingLobby':
            return (
                <LobbySelection
                    lobbies={LOBBIES}
                    player={player}
                    onLobbySelect={handleLobby1v1Action}
                    isFirebaseConfigured={IS_FIREBASE_CONFIGURED}
                    onCreateCustomLobby={handleCreateCustomLobby}
                    onJoinCustomLobby={handleJoinCustomLobby}
                    onFindPublicTeamMatch={handleFindPublicTeamMatch}
                />
            );
        case 'searching':
            return (
                <SearchingView
                    selectedLobbyName={selectedLobbyName}
                    onCancelSearch={() => setShowLeaveConfirm(true)}
                />
            );
        case 'inCustomLobby':
             if (!teamLobbyData || !customLobbyId) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading Custom Lobby...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
             }
            return (
                <CustomLobby 
                    player={player}
                    lobbyData={teamLobbyData}
                    lobbyCode={customLobbyId}
                    onJoinTeam={handleJoinTeam}
                    onLeave={() => setShowLeaveConfirm(true)}
                    onStartGame={() => startTeamBattle(selectedLobbyName || 'medium', teamLobbyData)}
                    onToggleLock={handleToggleLock}
                    onFillWithBots={handleFillWithBots}
                />
            );
        case 'inTeamFormation':
            if (!teamLobbyData || !customLobbyId) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Forming Teams...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
            }
            return (
                <TeamFormationLobby 
                    player={player}
                    lobbyData={teamLobbyData}
                    onLeave={() => handleLeaveConfirm()}
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
        case 'inTeamGame':
            if (!battleData || !teamBattleData || !player) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading team match...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
            }
            return (
                <TeamBattleView
                    battleData={teamBattleData}
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
            if ((!battleData && !teamBattleData) || !player) {
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
                    teamBattleData={teamBattleData}
                    player={player}
                    onFindNewMatch={handleFindNewMatch}
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
      <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={gameState === 'searching' || gameState === 'inTeamFormation' ? 'search' : (gameState === 'inCustomLobby' ? 'lobby' : (gameState === 'inGame' || gameState === 'inTeamGame' ? 'game' : null))}/>
    </>
  );
}

export function ArenaLeaveConfirmationDialog({ open, onOpenChange, onConfirm, type }: { open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void, type: 'search' | 'game' | 'lobby' | null }) {
  if (!type) return null;
  const title = type === 'search' ? "Cancel Search?" : type === 'lobby' ? "Leave Lobby?" : "Forfeit Match?";
  let description = `Are you sure you want to ${type === 'search' ? 'cancel the search' : type === 'lobby' ? 'leave the team formation lobby' : 'forfeit the match'}?`;

  if (type === 'search' || type === 'lobby') {
    description += " Your entry fee will be refunded.";
  } else {
    description += " This will count as a loss, and your wager will be lost.";
  }
    
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
            {type === 'search' ? "Cancel" : type === 'lobby' ? "Leave" : "Forfeit"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

    