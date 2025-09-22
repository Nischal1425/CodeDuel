

"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UsersRound, Target, Zap, Sparkles, Users } from 'lucide-react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import type { CompareCodeSubmissionsInput } from '@/ai/flows/compare-code-submissions';
import { compareCodeSubmissions } from '@/ai/flows/compare-code-submissions';
import { compareTeamSubmissions } from '@/ai/flows/compare-team-submissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import type { Player, MatchHistoryEntry, SupportedLanguage, Battle, TeamBattle, TeamLobby, TeamBattlePlayer, TeamLobbyPlayer } from '@/types';
import { ToastAction } from "@/components/ui/toast";
import { cn } from '@/lib/utils';
import { checkAchievementsOnMatchEnd } from '@/lib/achievement-logic';
import { db, rtdb } from '@/lib/firebase';
import { collection, doc, onSnapshot, updateDoc, serverTimestamp, writeBatch, runTransaction, setDoc, getDoc, increment } from "firebase/firestore";
import { ref, onValue, remove, set, get, child, goOffline, goOnline, serverTimestamp as rtdbServerTimestamp, runTransaction as rtdbRunTransaction } from "firebase/database";


// Component Imports
import { LobbySelection } from './_components/LobbySelection';
import type { DifficultyLobby, LobbyInfo } from './_components/LobbySelection';
import { SearchingView } from './_components/SearchingView';
import { TeamFormationLobby } from './_components/TeamFormationLobby';
import { DuelView } from './_components/DuelView';
import { TeamBattleView } from './_components/TeamBattleView';
import { GameOverReport } from './_components/GameOverReport';


const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!rtdb;

const DEFAULT_LANGUAGE: SupportedLanguage = "javascript";
const COMMISSION_RATE = 0.05; // 5% commission

type GameState = 'selectingLobby' | 'searching' | 'formingTeam' | 'inGame' | 'inTeamGame' | 'submittingComparison' | 'gameOver';

const LOBBIES: LobbyInfo[] = [
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 5, entryFee: 50, gameMode: '1v1' },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 10, entryFee: 100, gameMode: '1v1' },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 15, entryFee: 200, gameMode: '1v1' },
  { name: 'medium', title: 'Team DeathMatch', description: '4v4 tactical coding battle.', icon: Users, baseTime: 15, entryFee: 120, gameMode: '4v4' },
];

const initialTeamLobbyState: TeamLobby = {
    blue: { '1': null, '2': null, '3': null, '4': null },
    red: { '1': null, '2': null, '3': null, '4': null },
    battleId: null,
    status: 'waiting',
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
  const [battleData, setBattleData] = useState<Battle | null>(null);
  const [teamLobbyData, setTeamLobbyData] = useState<TeamLobby | null>(null);
  const [teamBattleId, setTeamBattleId] = useState<string | null>(null);
  const [teamBattleData, setTeamBattleData] = useState<TeamBattle | null>(null);

  
  const battleListenerUnsubscribe = useRef<() => void | undefined>();
  const playerQueueRef = useRef<any>();
  const playerBattleListenerUnsubscribe = useRef<() => void | undefined>();
  const teamLobbyRef = useRef<any>();
  const teamLobbyListenerUnsubscribe = useRef<() => void | undefined>();
  const teamBattleListenerUnsubscribe = useRef<() => void | undefined>();


  const cleanupListeners = useCallback(() => {
    if (battleListenerUnsubscribe.current) {
        battleListenerUnsubscribe.current();
        battleListenerUnsubscribe.current = undefined;
    }
    if (playerQueueRef.current) {
        remove(playerQueueRef.current);
        playerQueueRef.current = null;
    }
     if (teamLobbyListenerUnsubscribe.current) {
        teamLobbyListenerUnsubscribe.current();
        teamLobbyListenerUnsubscribe.current = undefined;
        if(teamLobbyRef.current) remove(teamLobbyRef.current);
        teamLobbyRef.current = null;
    }
     if (teamBattleListenerUnsubscribe.current) {
        teamBattleListenerUnsubscribe.current();
        teamBattleListenerUnsubscribe.current = undefined;
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
    setBattleData(null);
    setTeamLobbyData(null);
    setTeamBattleId(null);
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


 const processTeamGameEnd = useCallback(async (battle: TeamBattle) => {
    if (!player) return;

    const hasProcessedKey = `processed_team_match_${battle.id}`;
    if (sessionStorage.getItem(hasProcessedKey)) return;
    sessionStorage.setItem(hasProcessedKey, 'true');
    
    const isPlayerOnTeam1 = battle.team1.some(p => p.id === player.id);
    const playerTeam = isPlayerOnTeam1 ? 'team1' : 'team2';
    
    let outcome: 'win' | 'loss' | 'draw' = 'draw';
    if (battle.winnerTeam && battle.winnerTeam !== 'draw') {
        outcome = battle.winnerTeam === playerTeam ? 'win' : 'loss';
    }

    let toastTitle = "Team Match Over";
    let toastDesc = "The match has concluded.";
    let toastVariant: "default" | "destructive" = "default";
    
    if (outcome === 'win') {
        toastTitle="Team Victory!";
        toastDesc=`Your team won the deathmatch!`;
    } else if (outcome === 'draw') {
        toastTitle="Draw!";
        toastDesc=`The match ended in a draw. Your entry fee was refunded.`;
    } else {
        toastTitle="Team Defeat";
        toastDesc="The opposing team was victorious.";
        toastVariant="destructive";
    }

    const achievementResult = checkAchievementsOnMatchEnd(player, { won: outcome === 'win', opponentRank: 10, lobbyDifficulty: battle.difficulty });
    const finalPlayerStats = achievementResult.updatedPlayer;

    try {
        if (IS_FIREBASE_CONFIGURED) {
             const playerRef = doc(db, "players", player.id);
             await runTransaction(db, async (transaction) => {
                const playerDoc = await transaction.get(playerRef);
                if (!playerDoc.exists()) throw new Error("Player not found");
                const currentCoins = playerDoc.data().coins || 0;

                const updates: any = {
                    matchesPlayed: finalPlayerStats.matchesPlayed,
                    wins: finalPlayerStats.wins,
                    losses: finalPlayerStats.losses,
                    winStreak: finalPlayerStats.winStreak,
                    unlockedAchievements: finalPlayerStats.unlockedAchievements,
                };

                 if (outcome === 'win') {
                    const winnings = Math.floor(battle.wager * 2 * (1 - COMMISSION_RATE));
                    updates.coins = currentCoins + winnings;
                } else if (outcome === 'draw') {
                    updates.coins = currentCoins + battle.wager;
                }
                
                transaction.update(playerRef, updates);
            });
        }
    } catch (error) {
        console.error("Failed to update player stats for team game:", error);
        toast({ title: "Sync Error", description: "Could not save team match results.", variant: "destructive" });
    }

    toast({ title: toastTitle, description: toastDesc, variant: toastVariant, duration: 7000 });
    achievementResult.newlyUnlocked.forEach(showAchievementToast);
    
    setGameState('gameOver');

    setTimeout(() => {
        sessionStorage.removeItem(hasProcessedKey);
    }, 3000);
 }, [player, toast, showAchievementToast]);


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

  const handleTeamSubmissionFinalization = useCallback(async (currentBattle: TeamBattle) => {
    if (!player || !IS_FIREBASE_CONFIGURED) return;
    
    try {
        const result = await compareTeamSubmissions({
            team1: currentBattle.team1,
            team2: currentBattle.team2,
            question: currentBattle.question,
        });

        await updateDoc(doc(db, 'teamBattles', currentBattle.id), {
            team1: result.team1,
            team2: result.team2,
            team1Score: result.team1Score,
            team2Score: result.team2Score,
            winnerTeam: result.winnerTeam,
            status: 'completed',
        });

    } catch (error) {
        console.error("Error during team submission comparison:", error);
        toast({ title: "Comparison Error", description: "Could not compare team submissions.", variant: "destructive" });
        await updateDoc(doc(db, 'teamBattles', currentBattle.id), { status: 'completed' });
    }
  }, [player, toast]);


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
        // The current player (who initiated this transaction) is NOT added to the queue.
        // The opponent is removed from the queue.
        const opponentDataFromQueue = queue[opponentId];
        delete queue[opponentId];
        
        // Use an async IIFE to handle battle creation outside the transaction return.
        (async () => {
          try {
            const newBattleId = [player.id, opponentId].sort().join('_') + `_${Date.now()}`;
            const battleDocRef = doc(db, 'battles', newBattleId);

            // Fetch opponent's full data from Firestore
            const opponentDoc = await getDoc(doc(db, 'players', opponentId));
            if (!opponentDoc.exists()) throw new Error("Opponent data not found in Firestore.");
            const opponentData = opponentDoc.data() as Player;

            // Generate the coding challenge for the battle
            const question = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobby.name });
            
            // Define player1 and player2 based on sorted IDs
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
            
            // Notify both players of the battle ID via RTDB
            await set(ref(rtdb, `playerBattles/${player.id}`), newBattleId);
            await set(ref(rtdb, `playerBattles/${opponentId}`), newBattleId);

          } catch (e) {
            console.error("Failed to create battle:", e);
            toast({ title: "Match Creation Error", description: "Could not create the match.", variant: "destructive" });
            resetGameState(true);
          }
        })();

        // Return the queue with the opponent removed. The current player was never added.
        return queue; 
      } else {
        // --- No Opponent Found ---
        // Add the current player to the queue to wait for an opponent.
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

  const startTeamBattle = useCallback(async (finalLobbyData: TeamLobby) => {
    if (!player || !selectedLobbyName) return;

    try {
        const lobby = LOBBIES.find(l => l.name === selectedLobbyName && l.gameMode === '4v4');
        if (!lobby) throw new Error("Lobby configuration not found.");
        
        // 1. Generate challenge
        const question = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: selectedLobbyName });

        // 2. Create the TeamBattle document in Firestore
        const newTeamBattleRef = doc(collection(db, 'teamBattles'));

        const createTeamBattlePlayer = (lobbyPlayer: TeamLobbyPlayer): TeamBattlePlayer => ({
            ...lobbyPlayer,
            language: DEFAULT_LANGUAGE,
            code: getCodePlaceholder(DEFAULT_LANGUAGE, question),
            hasSubmitted: false,
        });

        const teamBattleData: TeamBattle = {
            id: newTeamBattleRef.id,
            team1: Object.values(finalLobbyData.blue || {}).filter(p => p !== null).map(p => createTeamBattlePlayer(p!)),
            team2: Object.values(finalLobbyData.red || {}).filter(p => p !== null).map(p => createTeamBattlePlayer(p!)),
            team1Score: 0,
            team2Score: 0,
            status: 'in-progress',
            difficulty: selectedLobbyName,
            wager: lobby.entryFee,
            question,
            createdAt: serverTimestamp(),
            winnerTeam: null,
        };
        await setDoc(newTeamBattleRef, teamBattleData);

        // 3. Update the RTDB lobby with the battleId to notify all players
        const teamLobbyBattleIdRef = ref(rtdb, `teamMatchmakingQueue/${selectedLobbyName}/battleId`);
        await set(teamLobbyBattleIdRef, newTeamBattleRef.id);
        
        // 4. Clean up the lobby after a short delay
        setTimeout(() => {
            if (teamLobbyRef.current) {
                remove(teamLobbyRef.current);
                teamLobbyRef.current = null;
            }
        }, 5000);

    } catch (error) {
        console.error("Error starting team battle:", error);
        toast({ title: 'Error', description: 'Could not start the team match.', variant: 'destructive' });
        // Optionally reset state or handle error
    }
  }, [player, selectedLobbyName, toast]);

  const setupTeamLobbyListener = useCallback(async (lobbyName: DifficultyLobby) => {
    if (!rtdb || !player) return;
    goOnline(rtdb);
    
    teamLobbyRef.current = ref(rtdb, `teamMatchmakingQueue/${lobbyName}`);
    
    const snapshot = await get(teamLobbyRef.current);
    if (!snapshot.exists()) {
        await set(teamLobbyRef.current, initialTeamLobbyState);
    }
    
    teamLobbyListenerUnsubscribe.current = onValue(teamLobbyRef.current, (snapshot) => {
        const data: TeamLobby | null = snapshot.val();
        if(data){
            setTeamLobbyData(data);

            const blueTeam = Object.values(data.blue || {}).filter(p => p !== null) as TeamLobbyPlayer[];
            const redTeam = Object.values(data.red || {}).filter(p => p !== null) as TeamLobbyPlayer[];
            
            const isLobbyFull = blueTeam.length === 4 && redTeam.length === 4;
            const amIInLobby = [...blueTeam, ...redTeam].some(p => p.id === player.id);
            const shouldStartMatch = isLobbyFull && amIInLobby && data.status === 'waiting';
            
            if (shouldStartMatch) {
                // Use a transaction to ensure only one client starts the match.
                const lobbyStatusRef = ref(rtdb, `teamMatchmakingQueue/${lobbyName}/status`);
                rtdbRunTransaction(lobbyStatusRef, (currentStatus) => {
                    if (currentStatus === 'waiting') {
                        return 'starting'; // Claim the right to start the match
                    }
                    return; // Abort transaction if someone else is already starting it
                }).then(({ committed }) => {
                    if (committed) {
                        // This client won the race, so it starts the battle.
                        startTeamBattle(data);
                    }
                });
            }

            if (data.battleId) {
                const lobby = LOBBIES.find(l => l.name === selectedLobbyName && l.gameMode === '4v4');
                if (lobby) setTimeRemaining(lobby.baseTime * 60);

                setTeamBattleId(data.battleId);
                toast({ title: 'Match Starting!', description: 'Your team deathmatch is about to begin.' });
                setGameState('inTeamGame'); 
            }

        } else {
             setTeamLobbyData(initialTeamLobbyState);
        }
    });
  }, [player, selectedLobbyName, startTeamBattle, toast]);


  const handleJoinTeam = async (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4') => {
      if (!player || !rtdb || !selectedLobbyName) return;

      const teamSlotRef = ref(rtdb, `teamMatchmakingQueue/${selectedLobbyName}/${team}/${slot}`);

      try {
        await rtdbRunTransaction(teamSlotRef, (currentData) => {
            if (currentData === null) {
                return { 
                    id: player.id,
                    username: player.username,
                    avatarUrl: player.avatarUrl || '',
                    rating: player.rating
                };
            } else {
                // Slot is already taken, so abort the transaction
                return; 
            }
        });
      } catch (error) {
        toast({ title: 'Error Joining Team', description: 'Could not join the team slot. It might have just been taken.', variant: 'destructive'});
        console.error("Error setting team slot:", error);
      }
  };
  

  const handleSelectLobby = async (lobbyInfo: LobbyInfo) => {
    if (!player) return;

    if (player.coins < lobbyInfo.entryFee) {
        toast({ title: "Insufficient Coins", description: `You need ${lobbyInfo.entryFee} coins to enter.`, variant: "destructive", action: <ToastAction altText="Buy Coins" onClick={() => router.push('/buy-coins')}>Buy Coins</ToastAction> });
        return;
    }
    
    // Deduct coins immediately for all modes now
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
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Error Entering Lobby", description: `Failed to deduct coins: ${errorMessage}`, variant: "destructive" });
            return; // Stop if coins can't be deducted
        }
    }


    if (lobbyInfo.gameMode === '4v4') {
        setSelectedLobbyName(lobbyInfo.name);
        setGameState('formingTeam');
        if(IS_FIREBASE_CONFIGURED) {
            await setupTeamLobbyListener(lobbyInfo.name);
        } else {
            setTeamLobbyData(initialTeamLobbyState);
        }
        return;
    }

    setGameState('searching');
    setSelectedLobbyName(lobbyInfo.name);

    if (IS_FIREBASE_CONFIGURED) {
      await findMatch(lobbyInfo);
    } else {
        startBotMatch(lobbyInfo);
    }
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
  }, [battleId, player, handleSubmissionFinalization, processGameEnd, toast, resetGameState, gameState]);


  useEffect(() => {
    if (!teamBattleId || !player || !IS_FIREBASE_CONFIGURED) return;
    
    const teamBattleDocRef = doc(db, 'teamBattles', teamBattleId);
    
    teamBattleListenerUnsubscribe.current = onSnapshot(teamBattleDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as TeamBattle;
            setTeamBattleData(data);
            
            const allPlayersSubmitted = [...data.team1, ...data.team2].every(p => p.hasSubmitted);

            if (data.status === 'in-progress' && allPlayersSubmitted) {
                 if (player?.id === data.team1[0].id) { // Only one player triggers the comparison
                    await updateDoc(docSnap.ref, { status: 'comparing' });
                    await handleTeamSubmissionFinalization(data);
                 }
            }

            if (data.status === 'completed' && gameState !== 'gameOver') {
                processTeamGameEnd(data);
            }

        } else {
             if (gameState !== 'selectingLobby') { 
                toast({ title: "Team Match Canceled", description: "The team match was removed.", variant: "default" });
                resetGameState();
             }
        }
    });

    return () => {
        if (teamBattleListenerUnsubscribe.current) {
            teamBattleListenerUnsubscribe.current();
        }
    }
  }, [teamBattleId, player, gameState, resetGameState, toast, processTeamGameEnd, handleTeamSubmissionFinalization]);


  const handleSubmitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim() || !player) return;

    if (gameState === 'inGame' && battleData) {
        const me = battleData.player1.id === player.id ? battleData.player1 : battleData.player2;
        if (me?.hasSubmitted) return;

        toast({ title: "Code Submitted!", description: "Your solution is locked in for the 1v1 duel.", className: "bg-primary text-primary-foreground" });
        
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
    } else if (gameState === 'inTeamGame' && teamBattleData) {
        if (!IS_FIREBASE_CONFIGURED) {
             toast({ title: "Offline Mode", description: "Team battles are not supported in offline mode.", variant: "destructive" });
             return;
        }

        const playerTeamKey = teamBattleData.team1.some(p => p.id === player.id) ? 'team1' : 'team2';
        const playerIndex = teamBattleData[playerTeamKey].findIndex(p => p.id === player.id);
        
        if (playerIndex === -1 || teamBattleData[playerTeamKey][playerIndex].hasSubmitted) return;

        toast({ title: "Code Submitted!", description: "Your solution is locked in for the team battle.", className: "bg-primary text-primary-foreground" });
        
        const teamBattleRef = doc(db, 'teamBattles', teamBattleData.id);
        const updatePayload = {
            [`${playerTeamKey}.${playerIndex}.code`]: code,
            [`${playerTeamKey}.${playerIndex}.language`]: language,
            [`${playerTeamKey}.${playerIndex}.hasSubmitted`]: true,
        };
        await updateDoc(teamBattleRef, updatePayload);
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
    } else if (gameState === 'inTeamGame' && teamBattleData && teamBattleData.status === 'in-progress') {
        toast({ title: "Time's Up!", description: "The match timer has expired. Comparing submissions...", variant: "destructive" });
        if (IS_FIREBASE_CONFIGURED && player.id === teamBattleData.team1[0].id) {
             const battleRef = doc(db, 'teamBattles', teamBattleData.id);
             await updateDoc(battleRef, { status: 'comparing' });
             await handleTeamSubmissionFinalization(teamBattleData);
        }
    }
  };

  const handleLeaveLobby = async () => {
    if (!player || !rtdb || !selectedLobbyName || !teamLobbyData) return;
    
    let playerFoundAndRemoved = false;
    for (const team of ['blue', 'red'] as const) {
        for (const slot of ['1', '2', '3', '4'] as const) {
            if (teamLobbyData[team][slot]?.id === player.id) {
                const teamSlotRef = ref(rtdb, `teamMatchmakingQueue/${selectedLobbyName}/${team}/${slot}`);
                await set(teamSlotRef, null);
                playerFoundAndRemoved = true;
                break;
            }
        }
        if (playerFoundAndRemoved) break;
    }
    
    resetGameState(true);
    toast({ title: 'Left Lobby', description: 'You have left the team formation lobby.'});
  };


  const handleLeaveConfirm = async () => {
    if (!player) return;
    setShowLeaveConfirm(false);

    const currentGameState = gameState; 
    
    // Unified coin refund logic
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
        // No refund on forfeit
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
    } else if (currentGameState === 'formingTeam') {
        await handleLeaveLobby(); // This handles DB cleanup for team lobby
        await refundCoins();
        resetGameState(true); // Resets all states
    } else if (currentGameState === 'inTeamGame') {
        // Forfeiting a team game is complex. For now, just leave.
        // No refund.
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
    // This effect now only runs when the battle data first arrives and initializes the code editor.
    if ((battleData?.question || teamBattleData?.question) && player && !hasInitializedCode.current) {
        const question = battleData?.question || teamBattleData?.question;
        
        let initialCode = getCodePlaceholder(language, question);
        let initialLanguage = DEFAULT_LANGUAGE;

        if (battleData) {
            const meInDb = battleData.player1.id === player.id ? battleData.player1 : battleData.player2;
            if (meInDb && !meInDb.hasSubmitted) {
                initialCode = meInDb.code || initialCode;
                initialLanguage = meInDb.language || initialLanguage;
            }
        } else if (teamBattleData) {
            const team = teamBattleData.team1.find(p => p.id === player.id) ? 'team1' : 'team2';
            const meInDb = teamBattleData[team].find(p => p.id === player.id);
            if (meInDb && !meInDb.hasSubmitted) {
                initialCode = meInDb.code || initialCode;
                initialLanguage = meInDb.language || initialLanguage;
            }
        }

        setCode(initialCode);
        setLanguage(initialLanguage);
        hasInitializedCode.current = true;
    }
  }, [battleData, teamBattleData, player, language]);


  // Make sure to clean up any listeners on component unmount
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
    // No language change persistence needed for team battles until submission
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
        case 'formingTeam':
             if (!teamLobbyData) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading Team Lobby...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
             }
            return (
                <TeamFormationLobby 
                    player={player}
                    lobbyData={teamLobbyData}
                    onJoinTeam={handleJoinTeam}
                    onLeave={() => setShowLeaveConfirm(true)}
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
        case 'inTeamGame':
             if (!teamBattleData || !player) {
                return <div className="flex flex-col items-center justify-center h-full p-4"><p className="mb-4">Loading Team Battle...</p><Loader2 className="h-8 w-8 animate-spin"/></div>;
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
      <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={gameState === 'searching' ? 'search' : (gameState === 'formingTeam' ? 'lobby' : (gameState === 'inGame' || gameState === 'inTeamGame' ? 'game' : null))}/>
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



    

    