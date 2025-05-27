
"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle, Send, UsersRound, Target, Zap, Swords, UserSquare2, Sparkles, HelpCircle, Brain } from 'lucide-react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import type { EvaluateCodeSubmissionOutput } from '@/ai/flows/evaluate-code-submission';
import { evaluateCodeSubmission } from '@/ai/flows/evaluate-code-submission';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { GameTimer } from './_components/GameTimer';
import { ProblemDisplay } from './_components/ProblemDisplay';
import type { Player } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_LANGUAGE = "javascript";

type GameState = 'selectingLobby' | 'searching' | 'inGame' | 'submittingEvaluation' | 'gameOver';
type DifficultyLobby = 'easy' | 'medium' | 'hard';

interface LobbyInfo {
  name: DifficultyLobby;
  title: string;
  description: string;
  icon: React.ElementType;
  baseTime: number; // minutes
  mockPlayerCount: string;
  mockWaitTime: string;
}

const LOBBIES: LobbyInfo[] = [
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 5, mockPlayerCount: "150+", mockWaitTime: "<15s" },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 10, mockPlayerCount: "80+", mockWaitTime: "<30s" },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 15, mockPlayerCount: "20+", mockWaitTime: "<60s" },
];

function LobbyCard({ lobby, onSelectLobby }: { lobby: LobbyInfo; onSelectLobby: (difficulty: DifficultyLobby) => void }) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col">
      <CardHeader className="items-center text-center">
        <lobby.icon className="h-12 w-12 text-primary mb-3" />
        <CardTitle className="text-2xl">{lobby.title}</CardTitle>
        <CardDescription>{lobby.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-1 text-sm text-muted-foreground flex-grow">
        <p>Players: {lobby.mockPlayerCount}</p>
        <p>Est. Wait: {lobby.mockWaitTime}</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => onSelectLobby(lobby.name)}>
          Join {lobby.name.charAt(0).toUpperCase() + lobby.name.slice(1)} Lobby
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ArenaPage() {
  const { player } = useAuth();
  const { toast } = useToast();

  const [gameState, setGameState] = useState<GameState>('selectingLobby');
  const [selectedLobby, setSelectedLobby] = useState<DifficultyLobby | null>(null);
  const [question, setQuestion] = useState<GenerateCodingChallengeOutput | null>(null);
  const [mockOpponent, setMockOpponent] = useState<Player | null>(null);
  
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [errorLoadingQuestion, setErrorLoadingQuestion] = useState<string | null>(null);
  
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [isSubmitting, setIsSubmitting] = useState(false); // General submission lock
  const [submissionResult, setSubmissionResult] = useState<EvaluateCodeSubmissionOutput | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0); // Controlled by GameTimer, but also held here
  const [gameOverReason, setGameOverReason] = useState<"solved" | "incorrect" | "timeup" | "error">("incorrect");


  const resetGameState = () => {
    setGameState('selectingLobby');
    setSelectedLobby(null);
    setQuestion(null);
    setMockOpponent(null);
    setCode('');
    setSubmissionResult(null);
    setIsSubmitting(false);
    setTimeRemaining(0);
    setErrorLoadingQuestion(null);
    setGameOverReason("incorrect");
  };

  const fetchQuestionForLobby = useCallback(async (lobbyName: DifficultyLobby) => {
    if (!player) return;

    setIsLoadingQuestion(true);
    setErrorLoadingQuestion(null);
    setQuestion(null);

    try {
      // Pass both playerRank and selected lobby as targetDifficulty
      const challenge = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: lobbyName });
      setQuestion(challenge);
      const lobbyDetails = LOBBIES.find(l => l.name === lobbyName);
      setTimeRemaining((lobbyDetails?.baseTime || 5) * 60); 
      setGameState('inGame');
    } catch (error) {
      console.error("Failed to generate coding challenge:", error);
      setErrorLoadingQuestion("Failed to load challenge. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch a new coding challenge.",
        variant: "destructive",
      });
      setGameState('selectingLobby'); // Go back to lobby selection on error
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [player, toast]);

  const handleSelectLobby = (lobbyName: DifficultyLobby) => {
    if (!player) {
      toast({ title: "Error", description: "Player data not found.", variant: "destructive" });
      return;
    }
    setSelectedLobby(lobbyName);
    setGameState('searching');

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
      setMockOpponent(mockOpponentDetails);
      toast({ title: "Opponent Found!", description: `Matched with ${mockOpponentDetails.username} (Rank ${mockOpponentDetails.rank})`, className: "bg-green-500 text-white"});
      fetchQuestionForLobby(lobbyName);
    }, 1500 + Math.random() * 1000); // Shorter search time
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: "Empty Code", description: "Please write some code before submitting.", variant: "destructive" });
      return;
    }
    if (!question || !question.solution || !selectedLobby) {
        toast({ title: "Error", description: "Game data missing. Cannot submit.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    setGameState('submittingEvaluation'); // New state for AI evaluation
    setSubmissionResult(null);

    try {
      const evaluationInput = {
        playerCode: code,
        referenceSolution: question.solution,
        problemStatement: question.problemStatement,
        language: language,
        difficulty: selectedLobby,
      };
      const evaluation = await evaluateCodeSubmission(evaluationInput);
      setSubmissionResult(evaluation);

      if (evaluation.isPotentiallyCorrect) {
        setGameOverReason("solved");
        toast({ title: "Submission Processed!", description: "AI assessed your solution as correct!", className: "bg-green-500 text-white" });
      } else {
        setGameOverReason("incorrect");
        toast({ title: "Submission Processed", description: "AI assessed your solution. See feedback below.", variant: "destructive" });
      }
    } catch (error) {
        console.error("Error during code evaluation:", error);
        toast({ title: "Evaluation Error", description: "Could not evaluate your submission. Mocking result.", variant: "destructive" });
        // Fallback to mock evaluation if AI fails
        const mockEvalResult: EvaluateCodeSubmissionOutput = {
            isPotentiallyCorrect: Math.random() > 0.5,
            correctnessExplanation: "AI evaluation failed, this is a mock result.",
            similarityToRefSolutionScore: Math.random(),
            similarityToRefSolutionExplanation: "N/A due to evaluation error.",
            estimatedTimeComplexity: "N/A",
            estimatedSpaceComplexity: "N/A",
            codeQualityFeedback: "Unable to provide AI feedback due to an error.",
            overallAssessment: "Evaluation could not be completed."
        };
        setSubmissionResult(mockEvalResult);
        setGameOverReason(mockEvalResult.isPotentiallyCorrect ? "solved" : "incorrect");
    } finally {
      setGameState('gameOver');
      setIsSubmitting(false); 
    }
  };

  const handleTimeUp = () => {
    toast({
      title: "Time's Up!",
      description: "The timer for this challenge has expired.",
      variant: "destructive",
    });
    setIsSubmitting(true); 
    setGameOverReason("timeup");
    setGameState('gameOver');
  };

  useEffect(() => {
    if (!player && gameState !== 'selectingLobby') {
        resetGameState();
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
      <div className="container mx-auto py-8">
        <Card className="mb-8 shadow-lg">
          <CardHeader className="text-center">
            <Swords className="h-16 w-16 mx-auto text-primary mb-4"/>
            <CardTitle className="text-3xl font-bold">Choose Your Arena</CardTitle>
            <CardDescription className="text-lg">Select a lobby based on your preferred difficulty and challenge.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6">
            {LOBBIES.map(lobby => (
              <LobbyCard key={lobby.name} lobby={lobby} onSelectLobby={handleSelectLobby} />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState === 'searching') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Finding Your Opponent...</h2>
        <p className="text-muted-foreground">Searching in the <span className="font-medium text-primary">{selectedLobby}</span> lobby for players around <span className="font-medium text-primary">Rank {player.rank}</span>.</p>
      </div>
    );
  }

  if (gameState === 'submittingEvaluation') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Sparkles className="h-16 w-16 animate-pulse text-accent mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">AI Analyzing Your Code...</h2>
        <p className="text-muted-foreground">Our AI is evaluating your solution for correctness, complexity, and quality.</p>
        <p className="text-sm text-muted-foreground mt-1">This might take a few moments.</p>
      </div>
    );
  }
  
  if (gameState === 'gameOver') {
    const resultIsSuccess = gameOverReason === "solved";
    return (
      <div className="container mx-auto py-8">
        <Card className={`shadow-xl ${resultIsSuccess ? 'border-green-500' : 'border-destructive'}`}>
          <CardHeader className="text-center">
            {gameOverReason === 'solved' && <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />}
            {gameOverReason === 'incorrect' && <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />}
            {gameOverReason === 'timeup' && <TimerIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />}
            
            <CardTitle className="text-3xl font-bold mb-2">
              {gameOverReason === 'solved' ? "Victory!" : (gameOverReason === 'timeup' ? "Time's Up!" : "Defeat!")}
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              {gameOverReason === 'solved' ? "The AI assessed your solution as correct!" : 
               gameOverReason === 'timeup' ? "You ran out of time." : 
               "The AI assessed your solution. See feedback below."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {submissionResult && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center"><Brain className="mr-2 h-5 w-5 text-primary"/> AI Analysis Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="font-medium text-foreground">Overall Assessment:</span>
                        <Badge variant={submissionResult.isPotentiallyCorrect ? "default" : "destructive"} className={submissionResult.isPotentiallyCorrect ? "bg-green-500 hover:bg-green-600 text-white" : ""}>
                            {submissionResult.isPotentiallyCorrect ? "Likely Correct" : "Likely Incorrect"}
                        </Badge>
                    </div>
                    <p><span className="font-medium text-foreground">Explanation:</span> {submissionResult.correctnessExplanation}</p>
                    <p><span className="font-medium text-foreground">Summary:</span> {submissionResult.overallAssessment}</p>
                    
                    <h4 className="font-semibold text-md text-foreground pt-2">Code Details:</h4>
                    <p><span className="font-medium">Similarity to Reference:</span> {(submissionResult.similarityToRefSolutionScore * 100).toFixed(0)}%</p>
                    <p><span className="font-medium">Similarity Explanation:</span> {submissionResult.similarityToRefSolutionExplanation}</p>
                    <p><span className="font-medium">Est. Time Complexity:</span> {submissionResult.estimatedTimeComplexity}</p>
                    <p><span className="font-medium">Est. Space Complexity:</span> {submissionResult.estimatedSpaceComplexity}</p>
                    
                    <h4 className="font-semibold text-md text-foreground pt-2">Quality Feedback:</h4>
                    <ScrollArea className="h-24 p-2 border rounded-md bg-background">
                        <p className="whitespace-pre-wrap">{submissionResult.codeQualityFeedback}</p>
                    </ScrollArea>
                </CardContent>
              </Card>
            )}
            <Button onClick={resetGameState} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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
        <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-xl text-destructive mb-2">{errorLoadingQuestion}</p>
            <Button onClick={resetGameState}>Back to Lobbies</Button>
        </div>
       );
    }
    if (!question || !mockOpponent) {
       return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/>Preparing match...</div>;
    }

    return (
      <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)]">
        <Card className="shadow-md">
          <CardContent className="p-3 flex justify-around items-center text-sm">
            <div className="flex items-center gap-2">
              <UserSquare2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="font-semibold text-foreground">{player.username} (You)</p>
                <p className="text-muted-foreground">Rank: {player.rank}, Rating: {player.rating}</p>
              </div>
            </div>
            <Swords className="h-6 w-6 text-muted-foreground"/>
            <div className="flex items-center gap-2">
              <UserSquare2 className="h-8 w-8 text-red-500" />
              <div>
                <p className="font-semibold text-foreground">{mockOpponent.username}</p>
                <p className="text-muted-foreground">Rank: {mockOpponent.rank}, Rating: {mockOpponent.rating}</p>
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
                                <p>The AI will analyze your code for correctness, efficiency (time/space complexity), and quality compared to the reference solution.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Select value={language} onValueChange={setLanguage} disabled={isSubmitting || timeRemaining === 0}>
                    <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="python" disabled>Python (soon)</SelectItem>
                    <SelectItem value="java" disabled>Java (soon)</SelectItem>
                    <SelectItem value="cpp" disabled>C++ (soon)</SelectItem>
                    </SelectContent>
                </Select>
                </div>
                <CardDescription>Write your code below. Defeat {mockOpponent.username}!</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow p-4 flex flex-col">
                <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`// Start coding in ${language}...\n// Problem Difficulty: ${question.difficulty}\n// Reference solution will be in JavaScript.`}
                className="flex-grow font-mono text-sm resize-none bg-input/50 border-input focus:border-primary h-[calc(100%-100px)]"
                disabled={isSubmitting || timeRemaining === 0}
                />
            </CardContent>
            <div className="p-4 border-t">
                <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !code.trim() || timeRemaining === 0}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Send className="mr-2 h-4 w-4" />
                )}
                Submit for AI Evaluation
                </Button>
                {timeRemaining === 0 && (
                 <p className="mt-2 text-sm text-destructive flex items-center"><AlertTriangle className="mr-1 h-4 w-4" />Time's up! Submission disabled.</p>
                )}
            </div>
            </Card>
        </div>
      </div>
    );
  }
  
  return (
      <div className="flex items-center justify-center h-full">
        <Button onClick={resetGameState}>Return to Lobby Selection</Button>
      </div>
  );
}
