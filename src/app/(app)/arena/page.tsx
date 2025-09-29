

"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UsersRound, Target, Zap, Sparkles, Users, Bot } from 'lucide-react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import type { CompareCodeSubmissionsInput } from '@/ai/flows/compare-code-submissions';
import { compareCodeSubmissions } from '@/ai/flows/compare-code-submissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import type { Player, MatchHistoryEntry, SupportedLanguage, Battle, TeamBattle, TeamLobby, TeamLobbyPlayer } from '@/types';
import { ToastAction } from "@/components/ui/toast";
import { cn } from '@/lib/utils';
import { checkAchievementsOnMatchEnd } from '@/lib/achievement-logic';
import { db, rtdb } from '@/lib/firebase';
import { collection, doc, onSnapshot, updateDoc, serverTimestamp, writeBatch, runTransaction, setDoc, getDoc, getDocs, query, where } from "firebase/firestore";
import { ref, onValue, remove, set, get, child, goOffline, goOnline, serverTimestamp as rtdbServerTimestamp, runTransaction as rtdbRunTransaction } from "firebase/database";


// Component Imports
import { LobbySelection } from './_components/LobbySelection';
import type { DifficultyLobby, LobbyInfo } from './_components/LobbySelection';
import { SearchingView } from './_components/SearchingView';
import { CustomLobby } from './_components/CustomLobby';
import { DuelView } from './_components/DuelView';
import { TeamBattleView } from './_components/TeamBattleView';
import { GameOverReport } from './_components/GameOverReport';


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!rtdb;

const DEFAULT_LANGUAGE: SupportedLanguage = "javascript";
const COMMISSION_RATE = 0.05; // 5% commission

type GameState = 'selectingLobby' | 'searching' | 'inCustomLobby' | 'inGame' | 'inTeamGame' | 'submittingComparison' | 'gameOver';

const LOBBIES: LobbyInfo[] = [
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 5, entryFee: 50, gameMode: '1v1' },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 10, entryFee: 100, gameMode: '1v1' },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 15, entryFee: 200, gameMode: '1v1' },
  { name: 'medium', title: 'Team DeathMatch', description: '4v4 tactical coding battle.', icon: Users, baseTime: 15, entryFee: 120, gameMode: '4v4' },
];

const initialTeamLobbyState: TeamLobby = {
    hostId: '',
    isPublic: false,
    status: 'waiting',
    teams: {
        blue: { '1': null, '2': null, '3': null, '4': null },
        red: { '1': null, '2': null, '3': null, '4': null },
    }
};


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
  const customLobbyRef = useRef<any>();
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
        if(customLobbyRef.current) remove(customLobbyRef.current);
        customLobbyRef.current = null;
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
    let allTeamBattles: Battle[] = [];
    
    // Use a transaction to safely update the count of finished duels
    try {
        await runTransaction(db, async (transaction) => {
            const teamBattleSnap = await transaction.get(teamBattleRef);
            if (!teamBattleSnap.exists()) return;
            
            const teamBattleDoc = teamBattleSnap.data() as TeamBattle;

            if (teamBattleDoc.status === 'completed') {
                 // Already processed by another client, but we still need to process game end for THIS player
                const playerBattle = (await getDoc(doc(db, 'battles', completedBattle.id))).data() as Battle;
                const playerTeam = teamBattleDoc.team1.some(p => p.id === player.id) ? 'team1' : 'team2';
                const teamOutcome = teamBattleDoc.winnerTeam === 'draw' ? 'draw' : (teamBattleDoc.winnerTeam === playerTeam ? 'win' : 'loss');
                await processGameEnd(playerBattle, teamOutcome);
                return;
            }

            const newFinishedCount = (teamBattleDoc.finishedDuels || 0) + 1;
            transaction.update(teamBattleRef, { finishedDuels: newFinishedCount });

            if (newFinishedCount === 4) { // All 4 duels are done
                const battlesQuery = query(collection(db, 'battles'), where("teamBattleId", "==", completedBattle.teamBattleId));
                const battlesSnapshot = await getDocs(battlesQuery);
                allTeamBattles = battlesSnapshot.docs.map(d => d.data() as Battle);
                
                let team1Wins = 0;
                let team2Wins = 0;
                const team1Ids = teamBattleDoc.team1.map(p => p.id);

                allTeamBattles.forEach(b => {
                    if (b.winnerId) {
                        if (team1Ids.includes(b.winnerId)) {
                            team1Wins++;
                        } else {
                            team2Wins++;
                        }
                    }
                });
                
                let winnerTeam: 'team1' | 'team2' | 'draw' = 'draw';
                if (team1Wins > team2Wins) winnerTeam = 'team1';
                else if (team2Wins > team1Wins) winnerTeam = 'team2';
                
                transaction.update(teamBattleRef, { status: 'completed', winnerTeam });

                // Since we can't call processGameEnd (which does writes) inside a transaction,
                // we'll rely on the listener of each client to pick up the 'completed' status
            }
        });

    } catch (e) {
        console.error("Error finalizing team battle:", e);
    }
}, [player, processGameEnd]);


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
    if (!player || !rtdb || !IS_FIREBASE_CONFIGURED) return;

    try {
        const lobby = LOBBIES.find(l => l.name === lobbyName && l.gameMode === '4v4');
        if (!lobby) throw new Error("Lobby configuration not found.");

        const teamBattleId = `team-battle-${Date.now()}`;
        const team1 = Object.values(finalLobbyData.teams.blue).filter((p): p is TeamLobbyPlayer => p !== null);
        const team2 = Object.values(finalLobbyData.teams.red).filter((p): p is TeamLobbyPlayer => p !== null);
        
        await setDoc(doc(db, 'teamBattles', teamBattleId), {
            id: teamBattleId,
            team1,
            team2,
            status: 'in-progress',
            difficulty: lobbyName,
            createdAt: serverTimestamp(),
            finishedDuels: 0,
            winnerTeam: null
        });

        const questionPromises = [
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
            generateCodingChallenge({ playerRank: 10, targetDifficulty: lobbyName }),
        ];
        const questions = await Promise.all(questionPromises);

        const battleCreationPromises = [];
        const battleNotifications: { [playerId: string]: string } = {};

        for (let i = 0; i < 4; i++) {
            const p1 = team1[i];
            const p2 = team2[i];
            if (!p1 || !p2) continue;

            const question = questions[i];
            const battleId = `${teamBattleId}_duel_${i + 1}`;

            const isP1Bot = p1.id.startsWith('bot_');
            const isP2Bot = p2.id.startsWith('bot_');

            const newBattle: Battle = {
                id: battleId,
                teamBattleId: teamBattleId,
                player1: { 
                    id: p1.id, 
                    username: p1.username, 
                    avatarUrl: p1.avatarUrl, 
                    language: DEFAULT_LANGUAGE, 
                    code: isP1Bot ? question.solution : getCodePlaceholder(DEFAULT_LANGUAGE, question), 
                    hasSubmitted: isP1Bot 
                },
                player2: { 
                    id: p2.id, 
                    username: p2.username, 
                    avatarUrl: p2.avatarUrl, 
                    language: DEFAULT_LANGUAGE, 
                    code: isP2Bot ? question.solution : getCodePlaceholder(DEFAULT_LANGUAGE, question), 
                    hasSubmitted: isP2Bot
                },
                status: 'in-progress',
                difficulty: lobbyName,
                wager: lobby.entryFee,
                question,
                createdAt: serverTimestamp(),
                startedAt: serverTimestamp(),
            };
            
            battleCreationPromises.push(setDoc(doc(db, 'battles', battleId), newBattle));
            
            if (!isP1Bot) battleNotifications[p1.id] = battleId;
            if (!isP2Bot) battleNotifications[p2.id] = battleId;
        }

        await Promise.all(battleCreationPromises);

        const notificationPromises = Object.entries(battleNotifications).map(([playerId, bId]) => {
            return set(ref(rtdb, `playerBattles/${playerId}`), bId);
        });
        await Promise.all(notificationPromises);
        
        await remove(ref(rtdb, `customLobbies/${customLobbyId}`));

    } catch (error) {
        console.error("Error starting team battle:", error);
        toast({ title: 'Error', description: 'Could not start the team battle.', variant: 'destructive' });
    }
}, [player, toast, customLobbyId]);

  const onLobbySelect = (lobby: LobbyInfo) => {
    // This function will be updated for custom lobbies.
    // For now, it just handles 1v1
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
      
      const wasSearchingOrInLobby = gameState === 'searching' || gameState === 'inCustomLobby';

      if (newBattleData.status === 'in-progress') {
        setGameState(currentState => {
            if (wasSearchingOrInLobby) {
                const lobby = LOBBIES.find(l => l.name === newBattleData.difficulty && l.gameMode === (newBattleData.teamBattleId ? '4v4' : '1v1'));
                if (lobby) setTimeRemaining(lobby.baseTime * 60);
                setTimeout(() => {
                  toast({ title: "Match Starting!", description: "Your duel is starting now!", className: "bg-green-500 text-white" });
                }, 0);
                return newBattleData.teamBattleId ? 'inTeamGame' : 'inGame';
            }
            return currentState;
        });
      }
      
      if (newBattleData.status === 'completed' || newBattleData.status === 'forfeited') {
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
          // Only one player (p1) should finalize
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

    if (gameState === 'inGame' && battleData) {
        const me = battleData.player1.id === player.id ? battleData.player1 : battleData.player2;
        if (me?.hasSubmitted) return;

        toast({ title: "Code Submitted!", description: "Your solution is locked in for the duel.", className: "bg-primary text-primary-foreground" });
        
        const playerKey = battleData.player1.id === player.id ? 'player1' : 'player2';

        if (IS_FIREBASE_CONFIGURED) {
            const updatePayload = {
                [`${playerKey}.code`]: code,
                [`${playerKey}.language`]: language,
                [`${playerKey}.hasSubmitted`]: true
            };
            await updateDoc(doc(db, "battles", battleData.id), updatePayload);
        } else {
            if (!playerKey || !battleData[playerKey]) return;
            const finalBattleState: Battle = {
                ...battleData,
                [playerKey]: {
                    ...battleData[playerKey]!,
                    code: code,
                    language: language,
                    hasSubmitted: true,
                },
                player2: {
                  ...battleData.player2!,
                  hasSubmitted: true, 
                }
            };

            setBattleData(finalBattleState);
            setGameState('submittingComparison');
            await handleSubmissionFinalization(finalBattleState);
        }
    }
  };

  const handleTimeUp = async () => {
    if (!player) return;
    
    if (gameState === 'inGame' && battleData && battleData.status === 'in-progress') {
        const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
        if (!opponent) return; 

        toast({ title: "Time's Up!", description: "You ran out of time and forfeited the duel.", variant: "destructive" });

        if (IS_FIREBASE_CONFIGURED) {
            await updateDoc(doc(db, "battles", battleData.id), {
                status: 'forfeited',
                winnerId: opponent.id 
            });
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
    
    if (currentGameState === 'searching') {
        cleanupListeners();
        await refundCoins();
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
    } else if (currentGameState === 'inCustomLobby') {
        // Leaving a custom lobby - will be implemented
        await refundCoins();
        resetGameState(true);
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
    if (battleData?.question && player && !hasInitializedCode.current) {
        const question = battleData.question;
        
        let initialCode = getCodePlaceholder(language, question);
        let initialLanguage = DEFAULT_LANGUAGE;

        const meInDb = battleData.player1.id === player.id ? battleData.player1 : battleData.player2;
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
    const question = battleData?.question || teamBattleData?.question;
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
                    onLobbySelect={onLobbySelect}
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
        case 'inCustomLobby':
             if (!teamLobbyData || !customLobbyId) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading Custom Lobby...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
             }
            return (
                <CustomLobby 
                    player={player}
                    lobbyData={teamLobbyData}
                    lobbyCode={customLobbyId}
                    onJoinTeam={() => {}}
                    onLeave={() => setShowLeaveConfirm(true)}
                    onStartGame={() => {}}
                    onToggleLock={() => {}}
                    onFillWithBots={() => {}}
                />
            );
        case 'inGame':
            if (!battleData) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading match...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
            }
            if (battleData && player) {
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
            }
            return null;
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
      <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={gameState === 'searching' ? 'search' : (gameState === 'inCustomLobby' ? 'lobby' : (gameState === 'inGame' || gameState === 'inTeamGame' ? 'game' : null))}/>
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


    

    
