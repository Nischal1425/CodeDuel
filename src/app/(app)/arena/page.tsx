
"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle, CheckCircle, Send, UsersRound, Target, Zap, Swords, UserSquare2, Sparkles, HelpCircle, Brain, Coins as CoinsIcon, TimerIcon, Flag, LogOut, PlaySquare, Info } from 'lucide-react';
import type { GenerateCodingChallengeOutput, TestCase } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import type { CompareCodeSubmissionsOutput } from '@/ai/flows/compare-code-submissions';
import { compareCodeSubmissions } from '@/ai/flows/compare-code-submissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { GameTimer } from './_components/GameTimer';
import { ProblemDisplay } from './_components/ProblemDisplay';
import type { Player } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToastAction } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';


const DEFAULT_LANGUAGE = "javascript";
const COMMISSION_RATE = 0.05; // 5% commission

type GameState = 'selectingLobby' | 'searching' | 'inGame' | 'submittingComparison' | 'gameOver';
type DifficultyLobby = 'easy' | 'medium' | 'hard';
type SupportedLanguage = "javascript" | "python" | "cpp";

type GameOverReason =
  | "comparison_player1_wins"
  | "comparison_player2_wins"
  | "comparison_draw"
  | "timeup_player1_submitted_only"
  | "timeup_player2_submitted_only"
  | "timeup_both_submitted"
  | "timeup_neither_submitted"
  | "forfeit_player1"
  | "error"
  | "cancelledSearch";


interface LobbyInfo {
  name: DifficultyLobby;
  title: string;
  description: string;
  icon: React.ElementType;
  baseTime: number; // minutes
  mockPlayerCount: string;
  mockWaitTime: string;
  entryFee: number;
}

const LOBBIES: LobbyInfo[] = [
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 5, mockPlayerCount: "150+", mockWaitTime: "<15s", entryFee: 50 },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 10, mockPlayerCount: "80+", mockWaitTime: "<30s", entryFee: 100 },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 15, mockPlayerCount: "20+", mockWaitTime: "<60s", entryFee: 200 },
];

interface TestResult {
  testCaseName: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  status: 'pass' | 'fail' | 'error' | 'not_run' | 'client_unsupported';
  errorMessage?: string;
  timeTaken?: string; // mock
  memoryUsed?: string; // mock
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
        <p>Players: {lobby.mockPlayerCount}</p>
        <p>Est. Wait: {lobby.mockWaitTime}</p>
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
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  const [selectedLobbyName, setSelectedLobbyName] = useState<DifficultyLobby | null>(null);
  const [currentLobbyDetails, setCurrentLobbyDetails] = useState<LobbyInfo | null>(null);
  const [question, setQuestion] = useState<GenerateCodingChallengeOutput | null>(null);
  const [mockOpponent, setMockOpponent] = useState<Player | null>(null);
  const mockOpponentRef = useRef(mockOpponent);
  useEffect(() => { mockOpponentRef.current = mockOpponent; }, [mockOpponent]);


  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [errorLoadingQuestion, setErrorLoadingQuestion] = useState<string | null>(null);

  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [isTestingCode, setIsTestingCode] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const [playerHasSubmittedCode, setPlayerHasSubmittedCode] = useState(false);
  const playerHasSubmittedCodeRef = useRef(playerHasSubmittedCode);
  useEffect(() => { playerHasSubmittedCodeRef.current = playerHasSubmittedCode; }, [playerHasSubmittedCode]);

  const [opponentHasSubmittedCode, setOpponentHasSubmittedCode] = useState(false);
  const opponentHasSubmittedCodeRef = useRef(opponentHasSubmittedCode);
  useEffect(() => { opponentHasSubmittedCodeRef.current = opponentHasSubmittedCode; }, [opponentHasSubmittedCode]);

  const [opponentCode, setOpponentCode] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<CompareCodeSubmissionsOutput | null>(null);

  const [timeRemaining, setTimeRemaining] = useState(0);
  const timeRemainingRef = useRef(timeRemaining);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);

  const [gameOverReason, setGameOverReason] = useState<GameOverReason>("error");

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveConfirmType, setLeaveConfirmType] = useState<'search' | 'game' | null>(null);

  const opponentSubmissionTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const resetGameState = (backToLobbySelection = true) => {
    if (backToLobbySelection) {
      setGameState('selectingLobby');
      setSelectedLobbyName(null);
      setCurrentLobbyDetails(null);
    }
    setQuestion(null);
    setMockOpponent(null);
    setCode('');
    setLanguage(DEFAULT_LANGUAGE);
    setIsTestingCode(false);
    setTestResults([]);
    setPlayerHasSubmittedCode(false);
    setOpponentHasSubmittedCode(false);
    setOpponentCode(null);
    setIsComparing(false);
    setComparisonResult(null);
    setTimeRemaining(0);
    setErrorLoadingQuestion(null);
    setGameOverReason("error");
    setShowLeaveConfirm(false);
    setLeaveConfirmType(null);
    if (opponentSubmissionTimeoutRef.current) {
      clearTimeout(opponentSubmissionTimeoutRef.current);
      opponentSubmissionTimeoutRef.current = null;
    }
  };

  const handleSubmissionFinalization = useCallback(async () => {
    if (!player || !question || !currentLobbyDetails || !opponentCode) {
      toast({ title: "Error", description: "Core game data missing for final comparison.", variant: "destructive" });
      setGameState('gameOver');
      setGameOverReason("error");
      return;
    }
    if (gameStateRef.current === 'submittingComparison' || gameStateRef.current === 'gameOver') return;

    setGameState('submittingComparison');
    setIsComparing(true);
    setComparisonResult(null);

    try {
      const comparisonInput = {
        player1Code: code || "", // Ensure code is not null
        player2Code: opponentCode,
        referenceSolution: question.solution,
        problemStatement: question.problemStatement,
        language: language,
        difficulty: currentLobbyDetails.name,
      };
      const result = await compareCodeSubmissions(comparisonInput);
      setComparisonResult(result);

      let finalPlayer = player;
      const entryFee = currentLobbyDetails.entryFee;

      if (result.winner === 'player1') {
        setGameOverReason("comparison_player1_wins");
        const totalPot = entryFee * 2;
        const commissionAmount = Math.floor(totalPot * COMMISSION_RATE);
        const winningsPaidOut = totalPot - commissionAmount;
        finalPlayer = { ...player, coins: player.coins + winningsPaidOut };
        setPlayer(finalPlayer);
        toast({ title: "Victory!", description: `You won the duel! ${winningsPaidOut} coins awarded.`, className: "bg-green-500 text-white", duration: 7000 });
      } else if (result.winner === 'player2') {
        setGameOverReason("comparison_player2_wins");
        toast({ title: "Defeat", description: "Your opponent's solution was deemed superior.", variant: "destructive", duration: 7000 });
        // Player already lost entry fee
      } else { // Draw
        setGameOverReason("comparison_draw");
        toast({ title: "Draw!", description: "The duel ended in a draw. Your entry fee was consumed.", variant: "default", duration: 7000 });
        // Player already lost entry fee
      }
    } catch (error) {
      console.error("Error during code comparison:", error);
      toast({ title: "Comparison Error", description: "Could not compare submissions. Mocking draw.", variant: "destructive" });
      setComparisonResult(null); // Or some default error comparison result
      setGameOverReason("error"); // Or comparison_error
    } finally {
      setIsComparing(false);
      setGameState('gameOver');
    }
  }, [player, question, currentLobbyDetails, opponentCode, code, language, setPlayer, toast]);

  const fetchQuestionForLobby = useCallback(async (lobbyInfo: LobbyInfo) => {
    if (!player || gameStateRef.current !== 'searching') {
        if (gameStateRef.current !== 'searching') {
            console.log("Search cancelled, not fetching question.");
        }
        return;
    }

    setIsLoadingQuestion(true);
    setErrorLoadingQuestion(null);
    setQuestion(null);

    try {
      const challenge = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobbyInfo.name });
      if (gameStateRef.current !== 'searching') {
           console.log("Search cancelled during question fetch.");
            if (player && lobbyInfo) { 
                const refundedPlayer = { ...player, coins: player.coins + lobbyInfo.entryFee };
                setPlayer(refundedPlayer);
                toast({ title: "Search Cancelled", description: `Entry fee of ${lobbyInfo.entryFee} coins refunded.`, variant: "default" });
            }
           resetGameState(true);
           return;
      }
      setQuestion(challenge);
      setOpponentCode(challenge.solution); // Mock opponent uses the reference solution
      setTimeRemaining(lobbyInfo.baseTime * 60);
      setGameState('inGame');

      // Simulate opponent submitting their code
      const opponentSubmitDelay = (lobbyInfo.baseTime * 60 * 1000) * (0.3 + Math.random() * 0.4); // Randomly between 30% and 70% of game time
      opponentSubmissionTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current === 'inGame' && !opponentHasSubmittedCodeRef.current) {
          setOpponentHasSubmittedCode(true);
          toast({ title: "Opponent Alert!", description: `${mockOpponentRef.current?.username || 'Opponent'} has submitted their solution!`, className: "bg-yellow-500 text-white" });
          // If player has also submitted, and time is left, trigger comparison
          if (playerHasSubmittedCodeRef.current && timeRemainingRef.current > 0) {
            handleSubmissionFinalization();
          }
        }
      }, opponentSubmitDelay);

    } catch (error) {
      console.error("Failed to generate coding challenge:", error);
      setErrorLoadingQuestion("Failed to load challenge. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch a new coding challenge.",
        variant: "destructive",
      });
      if (player && currentLobbyDetails) {
        const refundedPlayer = { ...player, coins: player.coins + currentLobbyDetails.entryFee };
        setPlayer(refundedPlayer);
        toast({ title: "Entry Fee Refunded", description: `Your ${currentLobbyDetails.entryFee} coins have been refunded.`, variant: "default" });
      }
      resetGameState(true);
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [player, toast, setPlayer, currentLobbyDetails, handleSubmissionFinalization]);


  const handleSelectLobby = (lobbyName: DifficultyLobby) => {
    if (!player) {
      toast({ title: "Error", description: "Player data not found.", variant: "destructive" });
      return;
    }

    const lobbyInfo = LOBBIES.find(l => l.name === lobbyName);
    if (!lobbyInfo) {
        toast({ title: "Error", description: "Selected lobby details not found.", variant: "destructive" });
        return;
    }

    if (player.coins < lobbyInfo.entryFee) {
        toast({
            title: "Insufficient Coins",
            description: `You need ${lobbyInfo.entryFee} coins (you have ${player.coins}).`,
            variant: "destructive",
            action: <ToastAction altText="Buy Coins" onClick={() => router.push('/buy-coins')}>Buy Coins</ToastAction>
        });
        return;
    }

    // Deduct entry fee
    const updatedPlayer = { ...player, coins: player.coins - lobbyInfo.entryFee };
    setPlayer(updatedPlayer);

    toast({
        title: "Joined Lobby!",
        description: `${lobbyInfo.entryFee} coins deducted for entry. Good luck!`,
        className: "bg-primary text-primary-foreground"
    });

    setSelectedLobbyName(lobbyName);
    setCurrentLobbyDetails(lobbyInfo);
    setGameState('searching');

    // Mock opponent details
    const opponentRank = Math.max(1, player.rank + Math.floor(Math.random() * 5) - 2); // Rank close to player
    const mockOpponentDetails: Player = {
      id: `bot_${Date.now()}`,
      username: `DuelBot${Math.floor(Math.random() * 1000)}`,
      coins: Math.floor(Math.random() * 5000) + 500, // Mock coins
      rank: opponentRank,
      rating: opponentRank * 75 + Math.floor(Math.random() * 100), // Mock rating
      avatarUrl: `https://placehold.co/40x40.png?text=DB`
    };

    // Simulate finding an opponent and then fetching the question
    setTimeout(() => {
      if (gameStateRef.current === 'searching') { // Check if still searching
        setMockOpponent(mockOpponentDetails);
        toast({ title: "Opponent Found!", description: `Matched with ${mockOpponentDetails.username} (Rank ${mockOpponentDetails.rank})`, className: "bg-green-500 text-white"});
        fetchQuestionForLobby(lobbyInfo);
      } else {
        // User might have cancelled search, refund logic is in fetchQuestionForLobby if it gets there
        console.log("Matchmaking timeout fired, but user already left 'searching' state.");
      }
    }, 1500 + Math.random() * 1000); // Simulate search time
  };


  const handleSubmitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) {
      toast({ title: "Empty Code", description: "Please write some code before submitting.", variant: "destructive" });
      return;
    }
    if (!question || !currentLobbyDetails || !player) {
        toast({ title: "Error", description: "Game data missing. Cannot submit.", variant: "destructive" });
        return;
    }
    if (playerHasSubmittedCode || gameStateRef.current !== 'inGame') return;

    setPlayerHasSubmittedCode(true);
    toast({title: "Code Submitted!", description: "Your solution is locked in.", className: "bg-primary text-primary-foreground"});

    // If opponent has already submitted, proceed to comparison
    if (opponentHasSubmittedCode) {
      handleSubmissionFinalization();
    }
    // Else, game will wait for opponent or time up
  };

  const handleTimeUp = () => {
    if (!player || !currentLobbyDetails || gameStateRef.current !== 'inGame') return;

    toast({
      title: "Time's Up!",
      description: "The timer for this challenge has expired.",
      variant: "destructive",
    });

    if (playerHasSubmittedCode && opponentHasSubmittedCode) {
      setGameOverReason("timeup_both_submitted");
      handleSubmissionFinalization();
    } else if (playerHasSubmittedCode && !opponentHasSubmittedCode) {
      // Player submitted, opponent timed out
      setGameOverReason("timeup_player1_submitted_only");
      handleSubmissionFinalization(); // Opponent's code will be empty/null, leading to player win
    } else if (!playerHasSubmittedCode && opponentHasSubmittedCode) {
      // Opponent submitted, player timed out
      setGameOverReason("timeup_player2_submitted_only");
      setCode(''); // Ensure player's code is considered empty for comparison
      handleSubmissionFinalization(); // Player's code will be empty, leading to opponent win
    } else {
      // Neither submitted
      setGameOverReason("timeup_neither_submitted");
      setGameState('gameOver'); // No comparison needed, both lose entry fee (already deducted)
    }
  };


  const handleLeaveConfirm = () => {
    setShowLeaveConfirm(false);
    if (leaveConfirmType === 'search') {
        if (player && currentLobbyDetails) {
            // Fee was already deducted. This toast confirms forfeiture.
            // No refund if they cancel search after joining.
            toast({ title: "Search Cancelled", description: `You left the lobby. Your entry fee of ${currentLobbyDetails.entryFee} coins was forfeited.`, variant: "default" });
        }
        resetGameState(true); 
        setGameOverReason("cancelledSearch"); 
    } else if (leaveConfirmType === 'game') {
        if (player && currentLobbyDetails) {
             // Fee was already deducted.
             toast({ title: "Match Forfeited", description: `You forfeited the match. Your entry fee of ${currentLobbyDetails.entryFee} coins was lost.`, variant: "destructive" });
        }
        setGameOverReason("forfeit_player1");
        setGameState('gameOver'); // This will show the game over screen with forfeit reason
    }
    setLeaveConfirmType(null);
  };

  const triggerLeave = (type: 'search' | 'game') => {
    setLeaveConfirmType(type);
    setShowLeaveConfirm(true);
  };

  const getCodePlaceholder = (selectedLang: SupportedLanguage): string => {
    switch (selectedLang) {
      case 'javascript':
        return `// Language: JavaScript
// Difficulty: ${question?.difficulty || 'N/A'} (Lobby: ${currentLobbyDetails?.name || 'N/A'})
// Problem Type: ${question?.problemStatement.substring(0,50) || 'N/A'}...

function solve(params) {
  // Your brilliant JavaScript code here!
  // Example: const n = params.n;
  // let result = 0;
  /* ... your logic ... */
  return result;
}

// The AI will evaluate the logic within your 'solve' function
// or the primary problem-solving part of your JavaScript code.
`;
      case 'python':
        return `# Language: Python
# Difficulty: ${question?.difficulty || 'N/A'} (Lobby: ${currentLobbyDetails?.name || 'N/A'})
# Problem Type: ${question?.problemStatement.substring(0,50) || 'N/A'}...

def solve(params):
  # Your brilliant Python code here!
  # Example: n = params.get('n') if isinstance(params, dict) else params
  # result = 0
  # ... your logic ...
  return result

# The AI will evaluate the logic within your 'solve' function
# or the primary problem-solving part of your Python code.
`;
      case 'cpp':
        return `// Language: C++
// Difficulty: ${question?.difficulty || 'N/A'} (Lobby: ${currentLobbyDetails?.name || 'N/A'})
// Problem Type: ${question?.problemStatement.substring(0,50) || 'N/A'}...

#include <iostream>
#include <vector>
// Add other necessary headers like <string>, <nlohmann/json.hpp> if using JSON

// You might need to parse 'params' if it's a JSON string,
// or adjust function signature based on problem.
// The AI will look for the main problem-solving logic.

// Example signature if params is a simple type or you parse it in main:
// auto solve(/* appropriate C++ type for params */) {
//    // ... your logic ...
//    return result;
// }

int main() {
  // For competitive programming style, read from std::cin
  // For Genkit evaluation, the 'solve' function or equivalent logic will be assessed.
  // Example:
  // int n;
  // std::cin >> n;
  // auto result = solve(n);
  // std::cout << result << std::endl;
  return 0;
}

// The AI will evaluate your primary C++ problem-solving logic,
// typically looking for a main function or a clearly defined solution function.
`;
      default:
        return "// Select a language to see a placeholder.";
    }
  };

  const handleRunTests = async () => {
    if (!question || !question.testCases || !code) {
        toast({ title: "Missing Data", description: "No question, test cases, or code to test.", variant: "destructive" });
        return;
    }
    setIsTestingCode(true);
    const results: TestResult[] = [];

    for (const tc of question.testCases) {
        let status: TestResult['status'] = 'not_run';
        let actualOutput = "N/A";
        let errorMessage: string | undefined;

        if (language === 'javascript') {
            try {
                // Dynamically create the function from the player's code string
                const playerFunctionFactory = new Function(`
                    "use strict";
                    ${code}
                    // Ensure 'solve' (or the main function name) is defined globally or returned
                    if (typeof solve !== 'function') {
                        throw new Error('The "solve" function is not defined in your code.');
                    }
                    return solve;
                `);
                const playerSolveFunction = playerFunctionFactory();

                if (typeof playerSolveFunction !== 'function') {
                     throw new Error('The "solve" function is not defined or not a function in your code.');
                }

                // Parse input if it's JSON, otherwise use as string
                let parsedInput = tc.input;
                try {
                    // Basic check for JSON structure, might need refinement
                    if ((tc.input.startsWith('{') && tc.input.endsWith('}')) || (tc.input.startsWith('[') && tc.input.endsWith(']'))) {
                        parsedInput = JSON.parse(tc.input);
                    }
                    // Add more robust parsing or type checking based on problem spec if possible
                } catch (e) {
                    // Input is not JSON or invalid JSON, use as string
                    // console.warn("Test case input is not valid JSON, using as string:", tc.input);
                }
                
                let outputFromSolve;
                try {
                    outputFromSolve = playerSolveFunction(parsedInput);
                } catch (solveError: any) {
                    // This error is from within the player's solve function execution
                    throw new Error(`Error in your solve function: ${solveError.message || String(solveError)}`);
                }
                
                // Stringify output for comparison if it's an object/array
                actualOutput = typeof outputFromSolve === 'object' ? JSON.stringify(outputFromSolve) : String(outputFromSolve);

                // Normalize expected output for comparison if it's a stringified object/array
                let normalizedExpectedOutput = tc.expectedOutput;
                 try {
                    // Attempt to parse and re-stringify to normalize JSON strings (e.g., whitespace differences)
                    const parsedExpected = JSON.parse(tc.expectedOutput);
                    normalizedExpectedOutput = JSON.stringify(parsedExpected);
                } catch (e) { /* not json, use as is */ }

                status = actualOutput === normalizedExpectedOutput ? 'pass' : 'fail';

            } catch (error: any) { // Catch errors from new Function, parsing, or the re-thrown solveError
                status = 'error';
                actualOutput = "Error during execution";
                errorMessage = error.message || String(error);
                console.error(`Error executing test case ${tc.name}:`, error, error.stack); // Log full stack for debugging
            }
        } else {
            status = 'client_unsupported';
            actualOutput = `Client-side test for ${language} not supported. Submit for AI eval.`;
        }

        results.push({
            testCaseName: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput,
            status,
            errorMessage,
            timeTaken: "N/A", // Mocked
            memoryUsed: "N/A", // Mocked
        });
    }
    setTestResults(results);
    setIsTestingCode(false);
  };


  useEffect(() => {
    // If player data is lost or becomes null while not in lobby selection, reset.
    if (!player && gameState !== 'selectingLobby') {
        // Consider if a toast message is needed here.
        // For now, just reset to avoid broken states.
        resetGameState(true);
    }
  }, [player, gameState]); // Removed resetGameState from deps as it's stable


  if (!player) { // Should be handled by layout, but good for direct page access defense
     return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl">Loading player data...</p>
      </div>
    );
  }

  if (gameState === 'selectingLobby') {
    return (
      <div className="container mx-auto py-8 h-full flex flex-col justify-center">
        <Card className="mb-8 shadow-lg">
          <CardHeader className="text-center">
            <Swords className="h-16 w-16 mx-auto text-primary mb-4"/>
            <CardTitle className="text-3xl font-bold">Choose Your Arena</CardTitle>
            <CardDescription className="text-lg">Select a lobby. Entry fees apply. Current Coins: {player.coins} <CoinsIcon className="inline h-5 w-5 text-yellow-500 align-text-bottom" /></CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6">
            {LOBBIES.map(lobby => (
              <LobbyCard key={lobby.name} lobby={lobby} onSelectLobby={handleSelectLobby} disabled={player.coins < lobby.entryFee}/>
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
        <h2 className="text-2xl font-semibold text-foreground mb-2">Finding Your Opponent...</h2>
        <p className="text-muted-foreground">Searching in the <span className="font-medium text-primary">{selectedLobbyName}</span> lobby for players around <span className="font-medium text-primary">Rank {player.rank}</span>.</p>
        <p className="text-sm text-muted-foreground mt-1">Entry fee: {currentLobbyDetails?.entryFee} <CoinsIcon className="inline h-3 w-3 text-yellow-500 align-baseline" /></p>
        <Button variant="outline" onClick={() => triggerLeave('search')} className="mt-6">
            <LogOut className="mr-2 h-4 w-4" /> Cancel Search & Leave Lobby
        </Button>
      </div>
    );
  }

  if (gameState === 'submittingComparison') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <Sparkles className="h-16 w-16 animate-pulse text-accent mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Duel in Progress: AI Comparing Submissions...</h2>
        <p className="text-muted-foreground">Our AI is evaluating both your and your opponent's solutions to determine the victor.</p>
        <p className="text-sm text-muted-foreground mt-1">This might take a few moments.</p>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    const entryFeePaid = currentLobbyDetails?.entryFee || 0;
    let title = "Match Over";
    let message = "";
    let icon: React.ReactNode = <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;

    // Determine title, message, and icon based on gameOverReason and comparisonResult
    switch(gameOverReason) {
        case "comparison_player1_wins":
            title = "Victory!";
            const pot = entryFeePaid * 2;
            const commission = Math.floor(pot * COMMISSION_RATE);
            const netWinnings = pot - commission;
            message = `You defeated ${mockOpponent?.username || 'your opponent'}! ${netWinnings} coins added. (Pot: ${pot}, Commission: ${commission})`;
            icon = <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />;
            break;
        case "comparison_player2_wins":
            title = "Defeat!";
            message = `${mockOpponent?.username || 'Your opponent'} won the duel. You lost ${entryFeePaid} coins.`;
            icon = <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />;
            break;
        case "comparison_draw":
            title = "It's a Draw!";
            message = `The duel ended in a draw. Your entry fee of ${entryFeePaid} coins was consumed.`;
            icon = <Swords className="h-16 w-16 text-yellow-500 mx-auto mb-4" />;
            break;
        case "timeup_player1_submitted_only": // Player submitted, opponent timed out
            title = comparisonResult?.winner === 'player1' ? "Victory by Default!" : "Close Call!"; // Should always be player1 win if opponent code is empty
             const p1TimeoutWinnings = (entryFeePaid*2) - Math.floor(entryFeePaid*2*COMMISSION_RATE);
            message = comparisonResult?.winner === 'player1' 
                ? `Your opponent timed out after you submitted! You won ${p1TimeoutWinnings} coins.`
                : `Your opponent timed out. The match was considered a draw. You lost ${entryFeePaid} coins.`; // Fallback if comparison logic changes
            icon = comparisonResult?.winner === 'player1' ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" /> : <Swords className="h-16 w-16 text-yellow-500 mx-auto mb-4" />;
            break;
        case "timeup_player2_submitted_only": // Opponent submitted, player timed out
            title = "Defeat by Timeout";
            message = `You ran out of time after your opponent submitted. You lost ${entryFeePaid} coins.`;
            icon = <TimerIcon className="h-16 w-16 text-destructive mx-auto mb-4" />;
            break;
        case "timeup_both_submitted": // Both submitted but time ran out during comparison or before
             title = comparisonResult?.winner === 'player1' ? "Last Second Victory!" : (comparisonResult?.winner === 'player2' ? "Defeat at the Buzzer!" : "Draw at Timeout!");
             const bothSubmittedWinnings = (entryFeePaid*2) - Math.floor(entryFeePaid*2*COMMISSION_RATE);
             message = comparisonResult?.winner === 'player1' 
                ? `You won the duel right at the end! ${bothSubmittedWinnings} coins awarded.`
                : (comparisonResult?.winner === 'player2' ? `Your opponent's solution was superior at timeout. You lost ${entryFeePaid} coins.` : `Duel ended in a draw at timeout. Your ${entryFeePaid} coins were consumed.`);
            icon = comparisonResult?.winner === 'player1' ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" /> : (comparisonResult?.winner === 'player2' ? <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" /> : <Swords className="h-16 w-16 text-yellow-500 mx-auto mb-4" />);
            break;
        case "timeup_neither_submitted":
            title = "Stalemate!";
            message = `Neither you nor your opponent submitted in time. You both lost ${entryFeePaid} coins.`;
            icon = <TimerIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;
            break;
        case "forfeit_player1":
            title = "Match Forfeited";
            message = `You forfeited the match and lost ${entryFeePaid} coins.`;
            icon = <Flag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;
            break;
        case "cancelledSearch": // This typically won't show a full game over screen but reset. For completeness:
            title = "Search Cancelled";
            message = `You left the lobby. Your entry fee of ${entryFeePaid} coins was forfeited.`;
            // icon (could be LogOut or similar)
            break;
        case "error":
        default:
            title = "Match Error";
            message = `An error occurred during the match. Your entry fee of ${entryFeePaid} coins was lost.`;
            icon = <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />;
            break;
    }

    return (
      <div className="container mx-auto py-8 h-full flex flex-col justify-center p-4">
        <Card className={`shadow-xl ${gameOverReason === "comparison_player1_wins" ? 'border-green-500' : (gameOverReason === "comparison_player2_wins" || gameOverReason === "forfeit_player1" || gameOverReason === "error" ? 'border-destructive' : 'border-border')}`}>
          <CardHeader className="text-center">
            {icon}
            <CardTitle className="text-3xl font-bold mb-2">{title}</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {comparisonResult && (gameOverReason.startsWith("comparison_") || gameOverReason.startsWith("timeup_")) && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="comparison-details">
                  <AccordionTrigger className="text-lg hover:no-underline">
                    <Brain className="mr-2 h-5 w-5 text-primary"/> Detailed AI Duel Report
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                        <h4 className="font-semibold text-md text-foreground mb-1">Overall Duel Result:</h4>
                        <p><span className="font-medium">Winner:</span> {comparisonResult.winner === 'player1' ? (player?.username || 'You') : (comparisonResult.winner === 'player2' ? (mockOpponent?.username || 'Opponent') : 'Draw')}</p>
                        <p><span className="font-medium">Reason:</span> {comparisonResult.winningReason}</p>
                        <p><span className="font-medium">Comparison Summary:</span> {comparisonResult.comparisonSummary}</p>
                    </div>
                    <Accordion type="multiple" className="w-full space-y-2">
                        <AccordionItem value="player1-eval">
                            <AccordionTrigger className="text-md bg-muted/30 px-3 py-2 rounded hover:no-underline">Your Submission ({player?.username})</AccordionTrigger>
                            <AccordionContent className="p-3 border rounded-b-md text-sm space-y-1">
                                <p><strong>Correctness:</strong> {comparisonResult.player1Evaluation.isPotentiallyCorrect ? "Likely Correct" : "Likely Incorrect"}</p>
                                <p><strong>Explanation:</strong> {comparisonResult.player1Evaluation.correctnessExplanation}</p>
                                <p><strong>Time Complexity:</strong> {comparisonResult.player1Evaluation.estimatedTimeComplexity}</p>
                                <p><strong>Space Complexity:</strong> {comparisonResult.player1Evaluation.estimatedSpaceComplexity}</p>
                                <p><strong>Quality Feedback:</strong></p>
                                <ScrollArea className="h-20 p-1 border rounded text-xs bg-background"><pre className="whitespace-pre-wrap">{comparisonResult.player1Evaluation.codeQualityFeedback}</pre></ScrollArea>
                                <p><strong>Overall:</strong> {comparisonResult.player1Evaluation.overallAssessment}</p>
                            </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="player2-eval">
                            <AccordionTrigger className="text-md bg-muted/30 px-3 py-2 rounded hover:no-underline">Opponent's Submission ({mockOpponent?.username})</AccordionTrigger>
                            <AccordionContent className="p-3 border rounded-b-md text-sm space-y-1">
                                <p><strong>Correctness:</strong> {comparisonResult.player2Evaluation.isPotentiallyCorrect ? "Likely Correct" : "Likely Incorrect"}</p>
                                <p><strong>Explanation:</strong> {comparisonResult.player2Evaluation.correctnessExplanation}</p>
                                <p><strong>Time Complexity:</strong> {comparisonResult.player2Evaluation.estimatedTimeComplexity}</p>
                                <p><strong>Space Complexity:</strong> {comparisonResult.player2Evaluation.estimatedSpaceComplexity}</p>
                                <p><strong>Quality Feedback:</strong></p>
                                <ScrollArea className="h-20 p-1 border rounded text-xs bg-background"><pre className="whitespace-pre-wrap">{comparisonResult.player2Evaluation.codeQualityFeedback}</pre></ScrollArea>
                                <p><strong>Overall:</strong> {comparisonResult.player2Evaluation.overallAssessment}</p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
            <div className="text-center text-muted-foreground">
                Your coins: {player.coins} <CoinsIcon className="inline h-4 w-4 text-yellow-500 align-baseline"/>
            </div>
            <Button onClick={() => resetGameState(true)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
             Play Again (Back to Lobbies)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (gameState === 'inGame') {
    if (isLoadingQuestion && !question) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-xl">Loading your challenge...</p>
        </div>
      );
    }
    if (errorLoadingQuestion) {
       return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-xl text-destructive mb-2">{errorLoadingQuestion}</p>
            <Button onClick={() => resetGameState(true)}>Back to Lobbies</Button>
        </div>
       );
    }
    if (!question || !mockOpponent || !currentLobbyDetails) { // Ensure all critical data is loaded
       return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/>Preparing match...</div>;
    }

    return (
      <div className="flex flex-col gap-4 h-full p-4 md:p-6"> {/* Main page container */}
        {/* Top Bar: Player vs Opponent Info */}
        <Card className="shadow-md shrink-0">
          <CardContent className="p-3 flex justify-around items-center text-sm">
            <div className="flex items-center gap-2">
              <UserSquare2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-semibold text-foreground">{player.username} (You)</p>
                <p className="text-muted-foreground">Coins: {player.coins} <CoinsIcon className="inline h-3 w-3 text-yellow-500" /> | Rank: {player.rank}</p>
              </div>
            </div>
            <div className="text-center">
                 <Swords className="h-6 w-6 text-muted-foreground mx-auto"/>
                 <p className="text-xs text-primary font-medium">{currentLobbyDetails.title}</p>
                 <p className="text-xs text-yellow-600">Wager: {currentLobbyDetails.entryFee} <CoinsIcon className="inline h-3 w-3" /></p>
            </div>
            <div className="flex items-center gap-2">
              <UserSquare2 className="h-8 w-8 text-red-500" />
              <div>
                <p className="font-semibold text-foreground">{mockOpponent.username}</p>
                <p className="text-muted-foreground">Coins: {mockOpponent.coins} <CoinsIcon className="inline h-3 w-3 text-yellow-500" /> | Rank: {mockOpponent.rank}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content: Problem Display and Code Editor */}
        <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-0"> {/* Use min-h-0 for flex children to scroll */}
            {/* Left Panel: Problem Statement */}
            <Card className="lg:w-1/2 flex flex-col shadow-xl overflow-hidden">
              <CardHeader className="bg-card-foreground/5"> {/* Subtle bg for header */}
                  <div className="flex justify-between items-center">
                      <CardTitle className="text-2xl text-primary">Coding Challenge</CardTitle>
                      <GameTimer initialTime={timeRemaining} onTimeUp={handleTimeUp} />
                  </div>
              </CardHeader>
              <CardContent className="p-0 flex-grow overflow-y-auto"> {/* Allow content to scroll */}
                  <ProblemDisplay question={question} />
              </CardContent>
            </Card>

            {/* Right Panel: Code Editor & Actions */}
            <Card className="lg:w-1/2 flex flex-col shadow-xl overflow-hidden">
              <CardHeader className="bg-card-foreground/5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-2xl">Your Solution</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="h-5 w-5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                    <p>The AI will analyze your code for correctness, efficiency, and quality compared to the reference solution and opponent.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Select value={language} onValueChange={(value) => setLanguage(value as SupportedLanguage)} disabled={isComparing || playerHasSubmittedCode || timeRemaining === 0}>
                        <SelectTrigger className="w-[180px] bg-background">
                        <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="javascript">JavaScript</SelectItem>
                          <SelectItem value="python">Python</SelectItem>
                          <SelectItem value="cpp">C++</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <CardDescription>Write your code below. Defeat {mockOpponent.username}!</CardDescription>
                  {opponentHasSubmittedCode && !playerHasSubmittedCode && timeRemaining > 0 && (
                    <p className="mt-2 text-sm text-yellow-600 animate-pulse">Opponent has submitted! Your turn.</p>
                  )}
                  {playerHasSubmittedCode && !opponentHasSubmittedCode && timeRemaining > 0 && (
                    <p className="mt-2 text-sm text-blue-600">Your code is submitted. Waiting for opponent...</p>
                  )}
              </CardHeader>
              <CardContent className="flex-grow p-4 flex flex-col min-h-0"> {/* Allow content to scroll, min-h-0 */}
                  <Textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={getCodePlaceholder(language)}
                    className="flex-grow font-mono text-sm resize-none bg-input/50 border-input focus:border-primary min-h-[200px] md:min-h-[300px]"
                    disabled={isComparing || playerHasSubmittedCode || timeRemaining === 0}
                  />
              </CardContent>
              {/* Test Cases Accordion */}
              <Accordion type="single" collapsible className="w-full px-4 pb-2">
                <AccordionItem value="test-cases">
                    <AccordionTrigger className="text-md hover:no-underline py-2">
                        <PlaySquare className="mr-2 h-5 w-5 text-muted-foreground"/> View & Run Test Cases
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        {question.testCases && question.testCases.length > 0 ? (
                            <>
                                <div className="max-h-48 overflow-y-auto pr-2"> {/* Scrollable test case list */}
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Input</TableHead>
                                                <TableHead>Expected Output</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {question.testCases.map((tc, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium text-xs">{tc.name}</TableCell>
                                                    <TableCell className="text-xs"><pre className="whitespace-pre-wrap bg-muted/50 p-1 rounded text-xs">{tc.input}</pre></TableCell>
                                                    <TableCell className="text-xs"><pre className="whitespace-pre-wrap bg-muted/50 p-1 rounded text-xs">{tc.expectedOutput}</pre></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <Button onClick={handleRunTests} disabled={isTestingCode || !code.trim() || playerHasSubmittedCode || timeRemaining === 0} className="w-full mt-2" variant="outline">
                                    {isTestingCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Run My Code Against Tests
                                </Button>
                                {language !== 'javascript' && (
                                  <div className="mt-2 p-2 text-xs text-muted-foreground bg-muted rounded-md flex items-start">
                                    <Info size={16} className="mr-2 mt-0.5 shrink-0 text-blue-500"/>
                                    Client-side test execution for {language.toUpperCase()} is not supported. Please verify logic manually. AI evaluation on submission will process your code.
                                  </div>
                                )}
                                {testResults.length > 0 && (
                                    <ScrollArea className="mt-2 max-h-48"> {/* Scrollable test results */}
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Test</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Actual Output</TableHead>
                                                    <TableHead>Time</TableHead>
                                                    <TableHead>Memory</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {testResults.map((res, idx) => (
                                                    <TableRow key={idx} className={res.status === 'pass' ? 'bg-green-500/10' : (res.status === 'fail' ? 'bg-red-500/10' : (res.status === 'error' ? 'bg-yellow-500/10' : ''))}>
                                                        <TableCell className="font-medium text-xs">{res.testCaseName}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={res.status === 'pass' ? 'default' : (res.status === 'fail' || res.status === 'error' ? 'destructive' : 'secondary')}
                                                                   className={cn("capitalize text-xs", res.status === 'pass' ? 'bg-green-500 text-white hover:bg-green-600' : '')}>
                                                                {res.status === 'client_unsupported' ? 'Manual Check' : res.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            <pre className="whitespace-pre-wrap max-w-xs truncate">{res.actualOutput}</pre>
                                                            {res.errorMessage && <p className="text-destructive text-xs mt-1">{res.errorMessage}</p>}
                                                        </TableCell>
                                                        <TableCell className="text-xs">{res.timeTaken}</TableCell>
                                                        <TableCell className="text-xs">{res.memoryUsed}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                )}
                            </>
                        ) : <p className="text-sm text-muted-foreground">No test cases provided for this challenge.</p>}
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
              {/* Action Buttons */}
              <div className="p-4 border-t flex flex-col gap-2"> {/* Footer actions */}
                  <Button
                    onClick={handleSubmitCode}
                    disabled={isComparing || playerHasSubmittedCode || !code.trim() || timeRemaining === 0 || gameStateRef.current === 'submittingComparison'}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                  {gameStateRef.current === 'submittingComparison' ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Send className="mr-2 h-4 w-4" />)}
                  {playerHasSubmittedCode ? "Code Submitted" : "Submit for Final AI Duel"}
                  </Button>
                  <Button variant="outline" onClick={() => triggerLeave('game')} disabled={isComparing || timeRemaining === 0 || gameStateRef.current === 'submittingComparison'} className="w-full">
                      <Flag className="mr-2 h-4 w-4" /> Forfeit Match
                  </Button>
                  {timeRemaining === 0 && !playerHasSubmittedCode && (
                   <p className="mt-2 text-sm text-destructive flex items-center"><AlertTriangle className="mr-1 h-4 w-4" />Time's up! Your solution will be considered a non-submission.</p>
                  )}
              </div>
            </Card>
        </div>
      </div>
    );
  }

  // Fallback for unexpected game states
  return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="mb-4">An unexpected state has occurred.</p>
        <Button onClick={() => resetGameState(true)}>Return to Lobby Selection</Button>
      </div>
  );
}


// Dialog component for leave/forfeit confirmation
export function ArenaLeaveConfirmationDialog({ open, onOpenChange, onConfirm, type }: { open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void, type: 'search' | 'game' | null }) {
  if (!type) return null;

  const title = type === 'search' ? "Cancel Search?" : "Forfeit Match?";
  const description = type === 'search'
    ? "Are you sure you want to cancel the search and leave the lobby? Your entry fee will be forfeited."
    : "Are you sure you want to forfeit the match? This will count as a loss, and your entry fee will be forfeited.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {type === 'search' ? "Leave Lobby" : "Forfeit"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

    

    