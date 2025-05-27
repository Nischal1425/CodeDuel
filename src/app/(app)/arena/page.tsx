
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
    setComparisonResult(null);

    try {
      const comparisonInput = {
        player1Code: code || "",
        player2Code: opponentCode,
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
        setGameOverReason("comparison_player1_wins");
        const totalPot = entryFee * 2;
        const commissionAmount = Math.floor(totalPot * COMMISSION_RATE);
        const winningsPaidOut = totalPot - commissionAmount;
        finalPlayer = { ...player, coins: player.coins + winningsPaidOut };
        setPlayer(finalPlayer);
        toast({ title: "Victory!", description: `You won the duel! ${winningsPaidOut} coins awarded.`, className: "bg-green-500 text-white", duration: 7000 });
      } else if (result.winner === 'player2') {
        setGameOverReason("comparison_player2_wins");
        // Fee already deducted, no change to player coins on loss
        toast({ title: "Defeat", description: "Your opponent's solution was deemed superior.", variant: "destructive", duration: 7000 });
      } else {
        setGameOverReason("comparison_draw");
        // Fee already deducted, no change to player coins on draw
        toast({ title: "Draw!", description: "The duel ended in a draw. Your entry fee was consumed.", variant: "default", duration: 7000 });
      }
    } catch (error) {
      console.error("Error during code comparison:", error);
      toast({ title: "Comparison Error", description: "Could not compare submissions. Mocking draw.", variant: "destructive" });
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
                const refundedPlayer = { ...player, coins: player.coins + lobbyInfo.entryFee };
                setPlayer(refundedPlayer);
                toast({ title: "Search Cancelled", description: `Entry fee of ${lobbyInfo.entryFee} coins refunded.`, variant: "default" });
            }
           resetGameState(true);
           return;
      }

      setQuestion(challenge);
      setCode(getCodePlaceholder(language, challenge));
      setOpponentCode(challenge.solution);
      setTimeRemaining(lobbyInfo.baseTime * 60);
      setGameState('inGame');

      const opponentSubmitDelay = (lobbyInfo.baseTime * 60 * 1000) * (0.3 + Math.random() * 0.4);
      opponentSubmissionTimeoutRef.current = setTimeout(() => {
        if (gameStateRef.current === 'inGame' && !opponentHasSubmittedCodeRef.current) {
          setOpponentHasSubmittedCode(true);
          toast({ title: "Opponent Alert!", description: `${mockOpponentRef.current?.username || 'Opponent'} has submitted their solution!`, className: "bg-yellow-500 text-white" });
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
        toast({ title: "Entry Fee Refunded", description: `Your ${lobbyInfo.entryFee} coins have been refunded.`, variant: "default" });
      }
      resetGameState(true);
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
    setTestResults([]);

    const opponentRank = Math.max(1, player.rank + Math.floor(Math.random() * 5) - 2);
    const mockOpponentDetails: Player = {
      id: `bot_${Date.now()}`,
      username: `DuelBot${Math.floor(Math.random() * 1000)}`,
      coins: Math.floor(Math.random() * 5000) + 500,
      rank: opponentRank,
      rating: opponentRank * 75 + Math.floor(Math.random() * 100),
      avatarUrl: `https://placehold.co/40x40.png?text=DB`
    };

    setTimeout(() => {
      if (gameStateRef.current === 'searching') {
        setMockOpponent(mockOpponentDetails);
        toast({ title: "Opponent Found!", description: `Matched with ${mockOpponentDetails.username} (Rank ${mockOpponentDetails.rank})`, className: "bg-green-500 text-white"});
        fetchQuestionForLobby(lobbyInfo);
      } else {
        console.log("Matchmaking timeout fired, but user already left 'searching' state.");
      }
    }, 1500 + Math.random() * 1000);
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
    if (playerHasSubmittedCode || gameStateRef.current !== 'inGame') return;

    setPlayerHasSubmittedCode(true);
    toast({title: "Code Submitted!", description: "Your solution is locked in.", className: "bg-primary text-primary-foreground"});

    if (opponentHasSubmittedCodeRef.current) {
      handleSubmissionFinalization();
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
      setGameOverReason("timeup_player1_submitted_only");
      setOpponentCode("");
      handleSubmissionFinalization();
    } else if (!playerHasSubmittedCodeRef.current && opponentHasSubmittedCodeRef.current) {
      setGameOverReason("timeup_player2_submitted_only");
      setCode('');
      handleSubmissionFinalization();
    } else {
      setGameOverReason("timeup_neither_submitted");
      setGameState('gameOver');
    }
  };


  const handleLeaveConfirm = () => {
    setShowLeaveConfirm(false);
    const lobbyFee = currentLobbyDetailsRef.current?.entryFee || 0;

    if (leaveConfirmType === 'search') {
        if (player) {
             toast({ title: "Search Cancelled", description: `You left the lobby. Your entry fee of ${lobbyFee} coins was forfeited.`, variant: "default" });
        }
        resetGameState(true);
        setGameOverReason("cancelledSearch");
    } else if (leaveConfirmType === 'game') {
        if (player) {
             toast({ title: "Match Forfeited", description: `You forfeited the match. Your entry fee of ${lobbyFee} coins was lost.`, variant: "destructive" });
        }
        setGameOverReason("forfeit_player1");
        setGameState('gameOver');
    }
    setLeaveConfirmType(null);
  };

  const triggerLeave = (type: 'search' | 'game') => {
    setLeaveConfirmType(type);
    setShowLeaveConfirm(true);
  };

  const parseFunctionSignature = (signature: string, lang: SupportedLanguage): { name: string, params: string[], signature: string, returnType: string } => {
    let name = 'solve'; // Default if parsing fails
    let params: string[] = ['params']; // Default if parsing fails
    let sig = signature; // Use original signature as fallback
    let returnType = 'any'; // Default

    try {
        if (lang === 'javascript') {
            const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?::\s*([^{]*))?/;
            const match = signature.match(funcRegex);
            if (match) {
                name = match[1];
                params = match[2].trim() ? match[2].split(',').map(p => p.trim().split('=')[0].trim()) : [];
                sig = `function ${name}(${params.join(', ')})`; // Reconstruct for consistency
                if (match[3]) returnType = match[3].trim();
            } else {
                 sig = `function ${name}(${params.join(', ')})`;
            }
        } else if (lang === 'python') {
            const funcRegex = /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(->\s*([a-zA-Z0-9_\[\], ]+))?:/;
            const match = signature.match(funcRegex);
            if (match) {
                name = match[1];
                params = match[2].trim() ? match[2].split(',').map(p => p.trim().split('=')[0].trim().split(':')[0].trim()) : [];
                sig = `def ${name}(${match[2]}):`; // Keep original params string for placeholder
                if(match[4]) returnType = match[4].trim(); else returnType = 'None';
            } else {
                 sig = `def ${name}(${params.join(', ')}):`;
                 returnType = 'None';
            }
        } else if (lang === 'cpp') {
            const cppFuncRegex = /([\w:<>,\s\*&]+?)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;
            const match = signature.match(cppFuncRegex);
            if (match) {
                returnType = match[1].trim();
                name = match[2].trim();
                const paramsStr = match[3].trim();
                params = paramsStr ? paramsStr.split(',').map(p => {
                    const parts = p.trim().split(/\s+/);
                    return parts[parts.length -1].replace(/[&*]/g, '').trim();
                }) : [];
                sig = `${returnType} ${name}(${paramsStr})`;
            } else {
                sig = `void ${name}(/* parameters */)`; // Fallback with comment
                returnType = 'void';
            }
        }
    } catch (e) {
        console.error("Error parsing function signature:", signature, e);
        // Fallback to defaults if parsing fails
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
        python: `def solve(params):\n  # Your code here\n  pass\n  return None`,
        cpp: `#include <iostream>\n#include <vector>\n#include <string>\n// Add other necessary headers\n\nclass Solution {\npublic:\n    // Define your method here based on the problem statement\n    // e.g., int solve(int input) {\n    //     // Your code here\n    //     return 0;\n    // }\n};\n`
    };

    if (!currentQuestion?.functionSignature) {
        return defaultPlaceholders[selectedLang];
    }

    const { name: funcName, params: funcParams, signature: funcSignatureItself, returnType } = parseFunctionSignature(currentQuestion.functionSignature, selectedLang);

    let body = `\n  // Your code here\n`;
    let returnStatement = "";

    if (selectedLang === 'javascript') {
        if (returnType && returnType !== 'void' && returnType !== 'any' && !returnType.toLowerCase().includes('undefined')) {
            returnStatement = `\n  return; // TODO: Expected return type: ${returnType}\n`;
        } else {
            returnStatement = `\n  return;\n`;
        }
        return `${funcSignatureItself.replace(/\{\s*\}$/, '')} {${body}${returnStatement}}`;
    } else if (selectedLang === 'python') {
        body = `\n  # Your code here\n  pass\n`;
        if (returnType && returnType !== 'None' && returnType) {
            returnStatement = `  # TODO: Expected return type: ${returnType}\n`;
        }
        return `${funcSignatureItself.replace(/:$/, '')}:${body}${returnStatement}`;
    } else if (selectedLang === 'cpp') {
        let cppHeaders = `#include <iostream>\n#include <vector>\n#include <string>\n#include <algorithm>\n// Add other necessary headers based on the problem\n\n`;
        if (returnType && returnType !== 'void') {
             body += `\n  // TODO: Expected return type: ${returnType}\n  return {}; // Placeholder return, adjust as needed\n`;
        } else {
            body += `\n`;
        }
        // Ensure the signature doesn't already have a body
        const signatureOnly = funcSignatureItself.replace(/\s*\{[^]*\}\s*$/, '');
        return `${cppHeaders}class Solution {\npublic:\n    ${signatureOnly} {${body}    }\n};`;
    }
    return defaultPlaceholders[selectedLang];
  };


  useEffect(() => {
    if (question) {
      setCode(getCodePlaceholder(language, question));
    }
  }, [language, question]);


  const handleRunTests = async () => {
    if (!question || !question.testCases || !code) {
        toast({ title: "Missing Data", description: "No question, test cases, or code to test.", variant: "destructive" });
        return;
    }
    setIsTestingCode(true);
    const results: TestResult[] = [];

    const signatureInfo = question.functionSignature ? parseFunctionSignature(question.functionSignature, language) : null;


    for (const tc of question.testCases) {
        let status: TestResult['status'] = 'not_run';
        let actualOutput = "N/A";
        let errorMessage: string | undefined;

        if (language === 'javascript' && signatureInfo) {
            try {
                let parsedInput: any = tc.input;
                try {
                    if ((tc.input.startsWith('{') && tc.input.endsWith('}')) || (tc.input.startsWith('[') && tc.input.endsWith(']'))) {
                        parsedInput = JSON.parse(tc.input);
                    } else if (tc.input.startsWith('"') && tc.input.endsWith('"')) {
                         parsedInput = tc.input.slice(1, -1);
                    } else if (tc.input.trim() !== '' && !isNaN(Number(tc.input))) {
                         parsedInput = Number(tc.input);
                    }
                } catch (e) {
                    console.warn("Test case input was not valid JSON or number, passing as string: ", tc.input);
                }

                const paramsForPlayerFunc = signatureInfo.params.length === 1 && typeof parsedInput !== 'object' && parsedInput !== null
                    ? [parsedInput]
                    : signatureInfo.params.map(p => (parsedInput && typeof parsedInput === 'object') ? parsedInput[p] : undefined);


                const scriptToRun = `
                    "use strict";
                    // Player's code:
                    ${code}

                    // Wrapper to call the player's function from solve(params)
                    function solve(params) {
                      const playerFuncArgs = ${JSON.stringify(signatureInfo.params)}.map(paramName => params && typeof params === 'object' ? params[paramName] : ( ${signatureInfo.params.length} === 1 ? params : undefined) );

                      if (typeof ${signatureInfo.name} !== 'function') {
                          throw new Error('The function "${signatureInfo.name}" is not defined or not a function in your code.');
                      }
                      return ${signatureInfo.name}(...playerFuncArgs);
                    }

                    // For direct testing if params is simple:
                    // If test input 'tc.input' represents a single argument for player's function (not an object for solve(params))
                    // We will pass 'parsedInput' to solve, which will then pass it to the player's function if it expects one arg.
                    // If player's function expects multiple args, 'parsedInput' must be an object.
                    return solve(${signatureInfo.params.length === 1 && typeof parsedInput !== 'object' ? JSON.stringify(parsedInput) : JSON.stringify(parsedInput)});
                `;

                let outputFromSolve;
                try {
                    const playerFunctionFactory = new Function(scriptToRun);
                    outputFromSolve = playerFunctionFactory();
                } catch (solveError: any) {
                    throw new Error(`Error during execution of your wrapped solution: ${solveError.message || String(solveError)}`);
                }

                actualOutput = typeof outputFromSolve === 'object' && outputFromSolve !== null ? JSON.stringify(outputFromSolve) : String(outputFromSolve);

                let normalizedExpectedOutput = tc.expectedOutput;
                 try {
                    const parsedExpected = JSON.parse(tc.expectedOutput);
                    normalizedExpectedOutput = JSON.stringify(parsedExpected);
                } catch (e) { /* not json, use as is for comparison */ }


                status = actualOutput === normalizedExpectedOutput ? 'pass' : 'fail';

            } catch (error: any) {
                status = 'error';
                actualOutput = "Error during test execution";
                errorMessage = error.message || String(error);
                console.error("Test execution error details:", error);
            }
        } else {
            status = 'client_unsupported';
            actualOutput = `Client-side test for ${language.toUpperCase()} not supported. Submit for AI eval.`;
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

    