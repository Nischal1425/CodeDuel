
"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle, Send, UsersRound, Target, Zap, Swords, UserSquare2 } from 'lucide-react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { GameTimer } from './_components/GameTimer';
import { ProblemDisplay } from './_components/ProblemDisplay';
import type { Player } from '@/types';

const DEFAULT_LANGUAGE = "javascript";

type GameState = 'selectingLobby' | 'searching' | 'inGame' | 'gameOver';
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
  { name: 'easy', title: 'Easy Breezy', description: 'Perfect for warming up or new duelists.', icon: UsersRound, baseTime: 3, mockPlayerCount: "150+", mockWaitTime: "<15s" },
  { name: 'medium', title: 'Balanced Battle', description: 'A solid challenge for most players.', icon: Target, baseTime: 5, mockPlayerCount: "80+", mockWaitTime: "<30s" },
  { name: 'hard', title: 'Expert Arena', description: 'Only for the brave and skilled.', icon: Zap, baseTime: 10, mockPlayerCount: "20+", mockWaitTime: "<60s" },
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
  
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false); // For question fetching specifically
  const [errorLoadingQuestion, setErrorLoadingQuestion] = useState<string | null>(null);
  
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [timeRemaining, setTimeRemaining] = useState(0);

  const resetGameState = () => {
    setGameState('selectingLobby');
    setSelectedLobby(null);
    setQuestion(null);
    setMockOpponent(null);
    setCode('');
    setSubmissionStatus('idle');
    setIsSubmitting(false);
    setTimeRemaining(0);
    setErrorLoadingQuestion(null);
  };

  const fetchQuestionForLobby = useCallback(async (lobbyName: DifficultyLobby) => {
    if (!player) return;

    setIsLoadingQuestion(true);
    setErrorLoadingQuestion(null);
    setQuestion(null);

    try {
      const challenge = await generateCodingChallenge({ playerRank: player.rank });
      setQuestion(challenge);
      const lobbyDetails = LOBBIES.find(l => l.name === lobbyName);
      setTimeRemaining((lobbyDetails?.baseTime || 5) * 60); // Use baseTime from lobby
      setGameState('inGame');
    } catch (error) {
      console.error("Failed to generate coding challenge:", error);
      setErrorLoadingQuestion("Failed to load challenge. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch a new coding challenge.",
        variant: "destructive",
      });
      setGameState('error'); // Or back to 'selectingLobby'
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

    // Mock matchmaking
    const opponentRank = Math.max(1, player.rank + Math.floor(Math.random() * 5) - 2); // Similar rank
    const mockOpponentDetails: Player = {
      id: `bot_${Date.now()}`,
      username: `DuelBot${Math.floor(Math.random() * 1000)}`,
      coins: Math.floor(Math.random() * 5000) + 500,
      rank: opponentRank,
      rating: opponentRank * 75 + Math.floor(Math.random() * 100), // Mock rating based on rank
      avatarUrl: `https://placehold.co/40x40.png?text=DB`
    };
    
    setTimeout(() => {
      setMockOpponent(mockOpponentDetails);
      toast({ title: "Opponent Found!", description: `Matched with ${mockOpponentDetails.username} (Rank ${mockOpponentDetails.rank})`, className: "bg-green-500 text-white"});
      fetchQuestionForLobby(lobbyName);
    }, 2500 + Math.random() * 1500); // Simulate search time
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: "Empty Code", description: "Please write some code before submitting.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setSubmissionStatus('idle');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate submission check
    
    const isCorrect = Math.random() > 0.3; 
    if (isCorrect) {
      setSubmissionStatus('success');
      toast({ title: "Submission Successful!", description: "Your solution was correct.", className: "bg-green-500 text-white" });
      // In a real game, update player stats, coins, etc.
    } else {
      setSubmissionStatus('error');
      toast({ title: "Submission Failed", description: "Your solution was incorrect. Try again!", variant: "destructive" });
    }
    setIsSubmitting(false);
    setGameState('gameOver'); // Transition to game over state
  };

  const handleTimeUp = () => {
    toast({
      title: "Time's Up!",
      description: "The timer for this challenge has expired. Opponent wins by default.",
      variant: "destructive",
    });
    setIsSubmitting(true); // Disable further submissions
    setGameState('gameOver'); // Transition to game over state
  };

  useEffect(() => {
    // Reset to lobby selection if player data is lost or on initial mount without prior state
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
        <p className="text-sm text-muted-foreground mt-1">This shouldn't take long!</p>
      </div>
    );
  }

  if (gameState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-xl text-destructive mb-2">{errorLoadingQuestion || "An unexpected error occurred."}</p>
        <Button onClick={resetGameState}>Back to Lobbies</Button>
      </div>
    );
  }
  
  if (gameState === 'gameOver') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        {submissionStatus === 'success' && <CheckCircle className="h-16 w-16 text-green-500 mb-4" />}
        {submissionStatus === 'error' && <AlertTriangle className="h-16 w-16 text-destructive mb-4" />}
        {timeRemaining === 0 && submissionStatus === 'idle' && <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />}
        
        <h2 className="text-3xl font-bold mb-3">
          {submissionStatus === 'success' ? "Victory!" : "Defeat!"}
        </h2>
        <p className="text-lg text-muted-foreground mb-6">
          {submissionStatus === 'success' ? "You solved the problem correctly!" : 
           (timeRemaining === 0 && submissionStatus === 'idle' ? "Time ran out!" : "Your solution was incorrect.")}
        </p>
        {/* Could show coin changes or rating changes here */}
        <Button onClick={resetGameState} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          Play Again (Back to Lobbies)
        </Button>
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
    if (!question || !mockOpponent) {
       return <div className="flex items-center justify-center h-full"><p>Preparing match...</p></div>;
    }

    return (
      <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)]">
        {/* Player vs Opponent Info Bar */}
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
                <CardTitle className="text-2xl">Your Solution</CardTitle>
                <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
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
                placeholder={`// Start coding in ${language}...`}
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
                Submit Solution
                </Button>
                {submissionStatus === 'success' && (
                <p className="mt-2 text-sm text-green-600 flex items-center"><CheckCircle className="mr-1 h-4 w-4" />Correct! Well done.</p>
                )}
                {submissionStatus === 'error' && (
                <p className="mt-2 text-sm text-destructive flex items-center"><AlertTriangle className="mr-1 h-4 w-4" />Incorrect. Keep trying!</p>
                )}
                {timeRemaining === 0 && submissionStatus === 'idle' && (
                <p className="mt-2 text-sm text-destructive flex items-center"><AlertTriangle className="mr-1 h-4 w-4" />Time's up! Submission disabled.</p>
                )}
            </div>
            </Card>
        </div>
      </div>
    );
  }
  
  // Fallback for any unexpected state, though should be covered
  return (
      <div className="flex items-center justify-center h-full">
        <Button onClick={resetGameState}>Return to Lobby Selection</Button>
      </div>
  );
}


    