
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
  const currentLobbyDetailsRef = useRef(currentLobbyDetails);
  useEffect(() => { currentLobbyDetailsRef.current = currentLobbyDetails; }, [currentLobbyDetails]);


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
    setShowLeaveConfirm(false);
    setLeaveConfirmType(null);
    if (opponentSubmissionTimeoutRef.current) {
      clearTimeout(opponentSubmissionTimeoutRef.current);
      opponentSubmissionTimeoutRef.current = null;
    }
  };

 const handleSubmissionFinalization = useCallback(async () => {
    if (!player || !question || !currentLobbyDetailsRef.current || opponentCode === null) {
      toast({ title: "Error", description: "Core game data missing for final comparison.", variant: "destructive" });
      setGameState('gameOver');
      setGameOverReason("error");
      return;
    }
    if (gameStateRef.current === 'submittingComparison' || gameStateRef.current === 'gameOver') return;

    setGameState('submittingComparison');
    setIsComparing(true);
    setComparisonResult(null); // Clear previous comparison result

    try {
      const comparisonInput = {
        player1Code: code || "", // Send empty string if player code is empty
        player2Code: opponentCode, // opponentCode could be "" if they timed out without submitting
        referenceSolution: question.solution,
        problemStatement: question.problemStatement,
        language: language,
        difficulty: currentLobbyDetailsRef.current.name,
      };
      const result = await compareCodeSubmissions(comparisonInput);
      setComparisonResult(result);

      let finalPlayer = player;
      const entryFee = currentLobbyDetailsRef.current.entryFee;

      if (result.winner === 'player1') {
        const totalPot = entryFee * 2;
        const commissionAmount = Math.floor(totalPot * COMMISSION_RATE);
        const winningsPaidOut = totalPot - commissionAmount;
        finalPlayer = { ...player, coins: player.coins + winningsPaidOut };
        setPlayer(finalPlayer);
        setGameOverReason("comparison_player1_wins");
        toast({ title: "Victory!", description: `You won the duel! ${winningsPaidOut} coins awarded.`, className: "bg-green-500 text-white", duration: 7000 });
      } else if (result.winner === 'player2') {
        setGameOverReason("comparison_player2_wins");
        toast({ title: "Defeat", description: "Your opponent's solution was deemed superior.", variant: "destructive", duration: 7000 });
      } else { // Draw
        setGameOverReason("comparison_draw");
        toast({ title: "Draw!", description: "The duel ended in a draw. Your entry fee was consumed.", variant: "default", duration: 7000 });
      }
    } catch (error) {
      console.error("Error during code comparison:", error);
      toast({ title: "Comparison Error", description: "Could not compare submissions. Ending as error.", variant: "destructive" });
      setComparisonResult(null);
      setGameOverReason("error");
    } finally {
      setIsComparing(false);
      setGameState('gameOver');
    }
  }, [player, question, opponentCode, code, language, setPlayer, toast ]);


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
                // Fee already deducted, if search cancelled, this refund might be handled by cancel search logic
                // For now, let's assume cancel search handles its own refunds/forfeits.
            }
           resetGameState(true);
           return;
      }

      setQuestion(challenge);
      setCode(getCodePlaceholder(language, challenge));
      setOpponentCode(challenge.solution); // Mock opponent uses reference solution
      setTimeRemaining(lobbyInfo.baseTime * 60);
      setGameState('inGame');

      // Simulate opponent submitting their code
      const opponentSubmitDelay = (lobbyInfo.baseTime * 60 * 1000) * (0.3 + Math.random() * 0.4); // Submit between 30% and 70% of game time
      opponentSubmissionTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current === 'inGame' && !opponentHasSubmittedCodeRef.current) {
          setOpponentHasSubmittedCode(true);
          toast({ title: "Opponent Alert!", description: `${mockOpponentRef.current?.username || 'Opponent'} has submitted their solution!`, className: "bg-yellow-500 text-white" });
          // If player also submitted, and time hasn't run out, finalize
          if (playerHasSubmittedCodeRef.current && timeRemainingRef.current > 0) {
            handleSubmissionFinalization();
          }
        }
      }, opponentSubmitDelay);

    } catch (error: any) {
      console.error("Failed to generate coding challenge:", error);
      let userMessage = "Failed to load challenge. Please try again.";
      if (error.message && (error.message.includes("GoogleGenerativeAI Error") || error.message.includes("Service Unavailable") || error.message.includes("overloaded"))) {
        userMessage = "The AI service for generating challenges is currently busy or unavailable. Please try again in a few moments.";
      }
      setErrorLoadingQuestion(userMessage);
      toast({
        title: "Challenge Generation Error",
        description: userMessage,
        variant: "destructive",
        duration: 7000,
      });

      if (player && lobbyInfo) {
        const refundedPlayer = { ...player, coins: player.coins + lobbyInfo.entryFee };
        setPlayer(refundedPlayer);
        toast({ title: "Entry Fee Refunded", description: `Your ${lobbyInfo.entryFee} coins have been refunded due to challenge error.`, variant: "default" });
      }
      resetGameState(true); // Go back to lobby selection
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [player, toast, setPlayer, handleSubmissionFinalization, language]);


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
    setTestResults([]); // Clear test results from any previous game

    // Mock opponent generation
    const opponentRank = Math.max(1, player.rank + Math.floor(Math.random() * 5) - 2); // +/- 2 ranks
    const mockOpponentDetails: Player = {
      id: `bot_${Date.now()}`,
      username: `DuelBot${Math.floor(Math.random() * 1000)}`,
      coins: Math.floor(Math.random() * 5000) + 500, // Mock coins for opponent
      rank: opponentRank,
      rating: opponentRank * 75 + Math.floor(Math.random() * 100), // Mock rating
      avatarUrl: `https://placehold.co/40x40.png?text=DB`
    };

    // Simulate finding an opponent then fetching question
    setTimeout(() => {
      if (gameStateRef.current === 'searching') { // Check if still searching
        setMockOpponent(mockOpponentDetails);
        toast({ title: "Opponent Found!", description: `Matched with ${mockOpponentDetails.username} (Rank ${mockOpponentDetails.rank})`, className: "bg-green-500 text-white"});
        fetchQuestionForLobby(lobbyInfo);
      } else {
        console.log("Matchmaking timeout fired, but user already left 'searching' state.");
        // If user cancelled search, fee should have been handled by cancellation logic
      }
    }, 1500 + Math.random() * 1000); // Simulate 1.5-2.5s search time
  };


  const handleSubmitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) {
      toast({ title: "Empty Code", description: "Please write some code before submitting.", variant: "destructive" });
      return;
    }
    if (!question || !currentLobbyDetailsRef.current || !player) {
        toast({ title: "Error", description: "Game data missing. Cannot submit.", variant: "destructive" });
        return;
    }
    if (playerHasSubmittedCodeRef.current || gameStateRef.current !== 'inGame') return;

    setPlayerHasSubmittedCode(true);
    toast({title: "Code Submitted!", description: "Your solution is locked in.", className: "bg-primary text-primary-foreground"});

    if (opponentHasSubmittedCodeRef.current) {
      handleSubmissionFinalization();
    } else {
      // UI will show "Waiting for opponent..."
    }
  };

  const handleTimeUp = () => {
    if (!player || !currentLobbyDetailsRef.current || gameStateRef.current !== 'inGame') return;

    toast({
      title: "Time's Up!",
      description: "The timer for this challenge has expired.",
      variant: "destructive",
    });

    if (playerHasSubmittedCodeRef.current && opponentHasSubmittedCodeRef.current) {
      setGameOverReason("timeup_both_submitted");
      handleSubmissionFinalization();
    } else if (playerHasSubmittedCodeRef.current && !opponentHasSubmittedCodeRef.current) {
      // Player submitted, opponent did not. Compare player's code to an "empty" opponent submission.
      setOpponentCode(""); // Indicate opponent didn't submit
      setGameOverReason("timeup_player1_submitted_only");
      handleSubmissionFinalization();
    } else if (!playerHasSubmittedCodeRef.current && opponentHasSubmittedCodeRef.current) {
      // Opponent submitted, player did not. Compare opponent's code to player's "empty" submission.
      setCode(''); // Indicate player didn't submit
      setGameOverReason("timeup_player2_submitted_only");
      handleSubmissionFinalization();
    } else { // Neither submitted
      setGameOverReason("timeup_neither_submitted");
      setGameState('gameOver'); // Directly go to game over, no comparison needed
    }
  };


  const handleLeaveConfirm = () => {
    setShowLeaveConfirm(false);
    const lobbyFee = currentLobbyDetailsRef.current?.entryFee || 0;

    if (leaveConfirmType === 'search') {
        // Fee was deducted upon joining lobby. If search is cancelled, fee is forfeited.
        if (player) { // Player exists implies fee was deducted
             toast({ title: "Search Cancelled", description: `You left the lobby. Your entry fee of ${lobbyFee} coins was forfeited.`, variant: "default" });
        }
        resetGameState(true);
        setGameOverReason("cancelledSearch"); // This will show a specific message if needed, or just go to lobby
    } else if (leaveConfirmType === 'game') {
        // Fee was deducted upon joining. If forfeited, fee is lost.
        if (player) {
             toast({ title: "Match Forfeited", description: `You forfeited the match. Your entry fee of ${lobbyFee} coins was lost.`, variant: "destructive" });
        }
        setGameOverReason("forfeit_player1");
        setGameState('gameOver'); // Go to game over screen
    }
    setLeaveConfirmType(null);
  };

  const triggerLeave = (type: 'search' | 'game') => {
    setLeaveConfirmType(type);
    setShowLeaveConfirm(true);
  };

  const parseFunctionSignature = (signature: string, lang: SupportedLanguage): { name: string, params: string[], signature: string, returnType: string } => {
    let name = 'solve';
    let params: string[] = ['params'];
    let sig = signature;
    let returnType = 'any';

    try {
        if (lang === 'javascript') {
            // Regex to capture: function NAME(PARAMS_STRING) [: RETURN_TYPE] {
            const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*:\s*([^{]*))?/;
            const match = signature.match(funcRegex);
            if (match) {
                name = match[1];
                // Split params, trim whitespace, and remove default initializers for param names
                params = match[2].trim() ? match[2].split(',').map(p => p.trim().split('=')[0].trim()) : [];
                sig = `function ${name}(${params.join(', ')})`; // Reconstruct signature with cleaned params
                if (match[3]) returnType = match[3].trim();
            } else {
                 // Fallback if regex doesn't match complex signature from AI
                 sig = `function ${name}(${params.join(', ')})`;
            }
        } else if (lang === 'python') {
            // Regex to capture: def NAME(PARAMS_STRING) [-> RETURN_TYPE]:
            const funcRegex = /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([a-zA-Z0-9_\[\], ]+))?:\s*$/;
            const match = signature.match(funcRegex);
            if (match) {
                name = match[1];
                // Split params, trim, remove default initializers & type hints for param names
                params = match[2].trim() ? match[2].split(',').map(p => p.trim().split('=')[0].trim().split(':')[0].trim()) : [];
                sig = `def ${name}(${match[2]})`; // Keep original params string for placeholder fidelity
                if(match[3]) returnType = match[3].trim(); else returnType = 'None'; // Python default return
            } else {
                 sig = `def ${name}(${params.join(', ')}):`; // Fallback
                 returnType = 'None';
            }
        } else if (lang === 'cpp') {
            // Regex to capture: RETURN_TYPE NAME(PARAMS_STRING)
            // This is a simplified regex and might struggle with complex C++ types or templates in return/params.
            const cppFuncRegex = /([\w:<>,\s\*&]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;
            const match = signature.match(cppFuncRegex);
            if (match) {
                returnType = match[1].trim();
                name = match[2].trim();
                const paramsStr = match[3].trim();
                // Extract only param names, discarding types and defaults for the 'params' array
                params = paramsStr ? paramsStr.split(',').map(p => {
                    const parts = p.trim().split(/\s+/); // Split by space to separate type and name
                    return parts[parts.length -1].replace(/[&*]/g, '').trim(); // Get last part (name), remove &*
                }) : [];
                sig = `${returnType} ${name}(${paramsStr})`; // Full signature for placeholder
            } else {
                sig = `void ${name}(/* parameters */)`; // Fallback
                returnType = 'void';
            }
        }
    } catch (e) {
        console.error("Error parsing function signature:", signature, e);
        // Reset to generic defaults if parsing fails spectacularly
        if (lang === 'javascript') sig = `function solve(params)`;
        else if (lang === 'python') sig = `def solve(params):`;
        else if (lang === 'cpp') sig = `void solve(/* params */)`;
        name = 'solve';
        params = ['params'];
        returnType = lang === 'python' ? 'None' : (lang === 'cpp' ? 'void' : 'any');
    }
    return { name, params, signature: sig, returnType };
  };


  const getCodePlaceholder = (selectedLang: SupportedLanguage, currentQuestion: GenerateCodingChallengeOutput | null): string => {
    const defaultPlaceholders = {
      javascript: `function solve(params) {\n  // Your code here\n  return;\n}`,
      python: `def solve(params):\n  # Your code here\n  return None`,
      cpp: `#include <iostream>\n#include <vector>\n#include <string>\n\n// Using namespace std; // Optional\n\nclass Solution {\npublic:\n    // Define your method here based on problem, e.g.,\n    // int exampleMethod(int input) {\n    //     // Your code here\n    //     return 0;\n    // }\n};\n\n// Optional main for local testing:\n/*\nint main() {\n    Solution sol;\n    // std::cout << sol.exampleMethod(5) << std::endl;\n    return 0;\n}\n*/`
    };

    if (!currentQuestion?.functionSignature) {
      return defaultPlaceholders[selectedLang] || "// Select a language";
    }

    const { name: funcName, params: funcParamsList, signature: providedSignature, returnType } = parseFunctionSignature(currentQuestion.functionSignature, selectedLang);

    if (selectedLang === 'javascript') {
      return `${providedSignature} {\n  // Your code here for ${funcName}\n  // Expected return type: ${returnType}\n  \n  return; // Adjust return type as needed\n}`;
    } else if (selectedLang === 'python') {
      const pythonSignature = providedSignature.endsWith(':') ? providedSignature : `${providedSignature}:`;
      return `${pythonSignature}\n  # Your code here for ${funcName}\n  # Expected return type: ${returnType}\n  pass\n  # return None # Adjust return type as needed`;
    } else if (selectedLang === 'cpp') {
      // Remove any existing body from AI's signature string if it accidentally included one
      const signatureOnly = providedSignature.replace(/\s*\{[^]*\}\s*$/, '');
      let body = `\n  // Your code here for ${funcName}\n`;
      if (returnType && returnType.toLowerCase() !== 'void' && !returnType.includes("std::ostream") && !returnType.startsWith("void")) {
        body += `  // TODO: Expected return type: ${returnType}\n  return {}; // Placeholder, adjust as needed\n`;
      } else if (returnType.includes("std::ostream") || returnType.startsWith("void")) {
        body += `  // TODO: Implement logic. Print to cout if ostream, or ensure void function completes.\n`;
      }


      return `#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm> // Common algorithms\n#include <map> // Common data structures\n#include <set> // Common data structures\n// Add other necessary headers based on the problem\n\n// using namespace std; // Optional: uncomment if you prefer\n\nclass Solution {\npublic:\n    ${signatureOnly} {${body}    }\n};\n\n// Optional main for local testing (will not be run by evaluator):\n/*\nint main() {\n    Solution sol;\n    // Example usage based on funcName and params, adapt to your specific problem's signature\n    // e.g., if funcName is "twoSum" and params are "nums, target":\n    // std::vector<int> nums_val = {2, 7, 11, 15};\n    // int target_val = 9;\n    // std::vector<int> result = sol.${funcName}(nums_val, target_val);\n    // for (int x : result) { std::cout << x << " "; }\n    // std::cout << std::endl;\n    return 0;\n}\n*/`;
    }
    return defaultPlaceholders[selectedLang] || "// Language not fully supported for detailed placeholder yet.";
  };


  useEffect(() => {
    if (question) {
      setCode(getCodePlaceholder(language, question));
      setTestResults([]); // Clear test results when language or question changes
    }
  }, [language, question]);


  const handleRunTests = async () => {
    if (!question || !question.testCases || !code) {
        toast({ title: "Missing Data", description: "No question, test cases, or code to test.", variant: "destructive" });
        return;
    }
    setIsTestingCode(true);
    setTestResults([]);
    const results: TestResult[] = [];

    const signatureInfo = question.functionSignature ? parseFunctionSignature(question.functionSignature, language) : null;

    for (const tc of question.testCases) {
        let status: TestResult['status'] = 'not_run';
        let actualOutput = "N/A";
        let errorMessage: string | undefined;

        if (language === 'javascript' && signatureInfo) {
            try { // Outer try for parsing input and general setup
                let parsedInput: any;
                try {
                    // Attempt to parse if it looks like JSON object/array, or string literal, or number
                    if ((tc.input.startsWith('{') && tc.input.endsWith('}')) || (tc.input.startsWith('[') && tc.input.endsWith(']'))) {
                        parsedInput = JSON.parse(tc.input);
                    } else if (tc.input.startsWith('"') && tc.input.endsWith('"') && tc.input.length >= 2) {
                         parsedInput = JSON.parse(tc.input); // JSON.parse can handle string literals like "\"hello\""
                    } else if (tc.input.trim() !== '' && !isNaN(Number(tc.input))) {
                         parsedInput = Number(tc.input);
                    } else {
                        parsedInput = tc.input; // Pass as raw string if not clearly JSON/number/string literal
                    }
                } catch (e) {
                    console.warn("Test case input was not valid JSON or number, attempting to pass as string: ", tc.input, e);
                    parsedInput = tc.input; // Fallback to raw string if parsing fails
                }
                
                // Player's code as written in the textarea
                const playerCodeItself = code;
                // The name of the function the player is supposed to implement (e.g., "twoSum")
                const functionNameToCall = signatureInfo.name;
                // The parameter names the player's function expects (e.g., ["nums", "target"])
                const functionParamsExpected = signatureInfo.params;

                // Dynamically construct the script to run
                // This script defines a 'solve(params_wrapper)' function which then calls the player's specific function.
                let scriptToRun = `
                    "use strict";
                    // Player's submitted code (which defines 'functionNameToCall'):
                    ${playerCodeItself}

                    // Wrapper to call the player's specific function from a generic solve(params_wrapper)
                    // This is what 'new Function()' will execute.
                    // 'params_wrapper' is the 'parsedInput' from the test case.
                    function solve_wrapper_for_test_runner(params_wrapper_arg) {
                      if (typeof ${functionNameToCall} !== 'function') {
                        throw new Error('The function "${functionNameToCall}" (expected from problem signature "${signatureInfo.signature}") is not found or not a function in your code. Please ensure it is defined correctly.');
                      }
                      
                      let argsForPlayerFunc;
                      // Check if the player's function expects parameters
                      if (${functionParamsExpected.length} === 0) {
                          argsForPlayerFunc = [];
                      } 
                      // If player's function expects a single parameter, and params_wrapper_arg is not an object intended for destructuring
                      // or it's an array itself, pass params_wrapper_arg directly as the single argument.
                      else if (${functionParamsExpected.length} === 1 && (typeof params_wrapper_arg !== 'object' || params_wrapper_arg === null || Array.isArray(params_wrapper_arg) || Object.keys(params_wrapper_arg).length !== functionParamsExpected.length )) {
                          argsForPlayerFunc = [params_wrapper_arg];
                      } 
                      // If player's function expects multiple parameters (or one object parameter),
                      // and params_wrapper_arg is an object, map params_wrapper_arg's properties to arguments.
                      else if (typeof params_wrapper_arg === 'object' && params_wrapper_arg !== null && ${functionParamsExpected.length} > 0) {
                          argsForPlayerFunc = ${JSON.stringify(functionParamsExpected)}.map(paramName => {
                            if (params_wrapper_arg.hasOwnProperty(paramName)) {
                                return params_wrapper_arg[paramName];
                            }
                            // This warning is helpful for debugging mismatches
                            console.warn("Parameter '"+paramName+"' not found in test case input params object:", params_wrapper_arg, "Expected params:", ${JSON.stringify(functionParamsExpected)});
                            return undefined; 
                          });
                      } 
                      // Fallback if multiple params expected but params_wrapper_arg isn't an object, or other mismatches
                      else if (${functionParamsExpected.length} > 0 && (typeof params_wrapper_arg !== 'object' || params_wrapper_arg === null)) {
                           console.error("Mismatch: Expected multiple parameters for ${functionNameToCall}, but test case input 'params_wrapper_arg' is not an object. Input:", params_wrapper_arg);
                           throw new Error("Test case input structure does not match expected parameters for ${functionNameToCall}. Expected an object mapping parameter names to values, but received " + (typeof params_wrapper_arg));
                      }
                      else { 
                          // Default case or if functionParamsExpected is empty and params_wrapper_arg is simple
                          argsForPlayerFunc = [params_wrapper_arg];
                      }
                      return ${functionNameToCall}(...argsForPlayerFunc);
                    }
                    // The 'parsedInput' from the test case is passed as 'params_wrapper_arg'
                    return solve_wrapper_for_test_runner(${JSON.stringify(parsedInput)});
                `;
                
                let outputFromSolve;
                try { // Inner try specifically for executing the constructed player function
                  const playerFunctionFactory = new Function(scriptToRun);
                  outputFromSolve = playerFunctionFactory();
                } catch (solveError: any) {
                    status = 'error';
                    actualOutput = "Execution Error";
                    errorMessage = solveError.message || String(solveError);
                    results.push({
                        testCaseName: tc.name, input: tc.input, expectedOutput: tc.expectedOutput, actualOutput, status, errorMessage,
                        timeTaken: "N/A", memoryUsed: "N/A",
                    });
                    console.error("Test execution error in player's code:", solveError, "Input:", tc.input);
                    continue;
                }

                actualOutput = outputFromSolve === undefined ? "undefined" : (typeof outputFromSolve === 'object' && outputFromSolve !== null ? JSON.stringify(outputFromSolve) : String(outputFromSolve));
                
                let normalizedExpectedOutput = tc.expectedOutput;
                try { 
                    const parsedExpected = JSON.parse(tc.expectedOutput);
                    normalizedExpectedOutput = JSON.stringify(parsedExpected);
                } catch (e) { /* not json, use as is */ }

                status = actualOutput === normalizedExpectedOutput ? 'pass' : 'fail';

            } catch (setupError: any) { 
                status = 'error';
                actualOutput = "Error during test setup";
                errorMessage = `Test setup error: ${setupError.message || String(setupError)}`;
                console.error("Test setup error details:", setupError, "Input:", tc.input);
            }
        } else { // Python or C++
            status = 'client_unsupported';
            actualOutput = "N/A"; // Simplified from previous verbose message
        }

        results.push({
            testCaseName: tc.name,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput,
            status,
            errorMessage,
            timeTaken: "N/A", 
            memoryUsed: "N/A", 
        });
    }
    setTestResults(results);
    setIsTestingCode(false);
  };


  useEffect(() => {
    if (!player && gameState !== 'selectingLobby') {
        resetGameState(true);
    }
  }, [player, gameState]);


  if (!player) {
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
        <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={leaveConfirmType}/>
      </div>
    );
  }

  if (gameState === 'searching') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Finding Your Opponent...</h2>
        <p className="text-muted-foreground">Searching in the <span className="font-medium text-primary">{selectedLobbyName}</span> lobby for players around <span className="font-medium text-primary">Rank {player.rank}</span>.</p>
        <p className="text-sm text-muted-foreground mt-1">Entry fee: {currentLobbyDetailsRef.current?.entryFee} <CoinsIcon className="inline h-3 w-3 text-yellow-500 align-baseline" /></p>
        <Button variant="outline" onClick={() => triggerLeave('search')} className="mt-6">
            <LogOut className="mr-2 h-4 w-4" /> Cancel Search & Leave Lobby
        </Button>
        <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={leaveConfirmType}/>
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
    const entryFeePaid = currentLobbyDetailsRef.current?.entryFee || 0;
    let title = "Match Over";
    let message = "";
    let icon: React.ReactNode = <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;

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
        case "timeup_player1_submitted_only":
            title = comparisonResult?.winner === 'player1' ? "Victory by Default!" : "Close Call!";
             const p1TimeoutWinnings = (entryFeePaid*2) - Math.floor(entryFeePaid*2*COMMISSION_RATE);
            message = comparisonResult?.winner === 'player1'
                ? `Your opponent timed out after you submitted! You won ${p1TimeoutWinnings} coins.`
                : `Your opponent timed out. The match was considered a draw as your code was compared to an empty submission. You lost ${entryFeePaid} coins.`;
            icon = comparisonResult?.winner === 'player1' ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" /> : <Swords className="h-16 w-16 text-yellow-500 mx-auto mb-4" />;
            break;
        case "timeup_player2_submitted_only":
            title = "Defeat by Timeout";
            message = `You ran out of time after your opponent submitted. You lost ${entryFeePaid} coins.`;
            icon = <TimerIcon className="h-16 w-16 text-destructive mx-auto mb-4" />;
            break;
        case "timeup_both_submitted":
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
        case "cancelledSearch":
            title = "Search Cancelled";
            message = `You left the lobby. Your entry fee of ${entryFeePaid} coins was forfeited.`;
            icon = <LogOut className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            break;
        case "error":
        default:
            title = "Match Error";
            message = `An error occurred during the match. Your entry fee of ${entryFeePaid} coins may have been lost. Please check your balance.`;
            icon = <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />;
            break;
    }
    
    let winningCodeDisplay: { name: string | null; code: string | null } = { name: null, code: null };
    if (comparisonResult && (comparisonResult.winner === 'player1' || comparisonResult.winner === 'player2')) {
        if (comparisonResult.winner === 'player1' && player) {
            winningCodeDisplay = { name: player.username, code: code };
        } else if (comparisonResult.winner === 'player2' && mockOpponentRef.current) {
            winningCodeDisplay = { name: mockOpponentRef.current.username, code: opponentCode };
        }
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

                    {winningCodeDisplay.code && winningCodeDisplay.name && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-semibold text-md text-foreground mb-2">
                          Winning Submission by {winningCodeDisplay.name}:
                        </h4>
                        <ScrollArea className="h-40 p-2 border rounded bg-muted/20">
                          <pre className="whitespace-pre-wrap text-xs">
                            {winningCodeDisplay.code}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}

                    <Accordion type="multiple" className="w-full space-y-2 pt-4">
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
            <Button onClick={() => { resetGameState(true); setGameOverReason("error"); }} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
             Play Again (Back to Lobbies)
            </Button>
          </CardContent>
        </Card>
        <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={leaveConfirmType}/>
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
            <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={leaveConfirmType}/>
        </div>
       );
    }
    if (!question || !mockOpponent || !currentLobbyDetailsRef.current) {
       return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/>Preparing match...</div>;
    }

    return (
      <div className="flex flex-col gap-4 h-full p-4 md:p-6">
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
                 <p className="text-xs text-primary font-medium">{currentLobbyDetailsRef.current.title}</p>
                 <p className="text-xs text-yellow-600">Wager: {currentLobbyDetailsRef.current.entryFee} <CoinsIcon className="inline h-3 w-3" /></p>
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

        <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-0">
            <Card className="lg:w-1/2 flex flex-col shadow-xl overflow-hidden">
              <CardHeader className="bg-card-foreground/5">
                  <div className="flex justify-between items-center">
                      <CardTitle className="text-2xl text-primary">Coding Challenge</CardTitle>
                      <GameTimer initialTime={timeRemaining} onTimeUp={handleTimeUp} />
                  </div>
              </CardHeader>
              <CardContent className="p-0 flex-grow overflow-y-auto">
                  <ProblemDisplay question={question} />
              </CardContent>
            </Card>

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
              <CardContent className="flex-grow p-4 flex flex-col min-h-0">
                  <Textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={getCodePlaceholder(language, question)}
                    className="flex-grow font-mono text-sm resize-none bg-input/50 border-input focus:border-primary min-h-[200px] md:min-h-[300px]"
                    disabled={isComparing || playerHasSubmittedCode || timeRemaining === 0}
                  />
              </CardContent>
              <Accordion type="single" collapsible className="w-full px-4 pb-2">
                <AccordionItem value="test-cases">
                    <AccordionTrigger className="text-md hover:no-underline py-2">
                        <PlaySquare className="mr-2 h-5 w-5 text-muted-foreground"/> View & Run Test Cases
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        {question.testCases && question.testCases.length > 0 ? (
                            <>
                                <div className="max-h-48 overflow-y-auto pr-2">
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
                                    <ScrollArea className="mt-2 max-h-48">
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
                                                                   className={cn("capitalize text-xs", 
                                                                                res.status === 'pass' ? 'bg-green-500 text-white hover:bg-green-600' : 
                                                                                (res.status === 'client_unsupported' ? 'bg-muted hover:bg-muted/80 text-muted-foreground' : ''))}>
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
              <div className="p-4 border-t flex flex-col gap-2">
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
        <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={leaveConfirmType}/>
      </div>
    );
  }

  return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="mb-4">An unexpected state has occurred. Current state: {gameState}</p>
        <Button onClick={() => resetGameState(true)}>Return to Lobby Selection</Button>
        <ArenaLeaveConfirmationDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm} onConfirm={handleLeaveConfirm} type={leaveConfirmType}/>
      </div>
  );
}

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
    
