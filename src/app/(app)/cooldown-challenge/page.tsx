
"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldQuestion, CheckCircle, AlertTriangle, Info, Brain, Coins as CoinsIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import type { EvaluateCodeSubmissionOutput } from '@/ai/flows/evaluate-code-submission';
import { evaluateCodeSubmission } from '@/ai/flows/evaluate-code-submission';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const COOLDOWN_DURATION_HOURS = 3;
const COOLDOWN_REWARD_COINS = 50;
const ELIGIBILITY_COIN_THRESHOLD = 50;

export default function CooldownChallengePage() {
  const { toast } = useToast();
  const { player, setPlayer, isLoading: authLoading } = useAuth();

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionEvaluation, setSubmissionEvaluation] = useState<EvaluateCodeSubmissionOutput | null>(null);
  
  const [timeCooldownActive, setTimeCooldownActive] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState("");
  
  const [challenge, setChallenge] = useState<GenerateCodingChallengeOutput | null>(null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);
  const [errorLoadingChallenge, setErrorLoadingChallenge] = useState<string | null>(null);

  const fetchCooldownChallenge = useCallback(async () => {
    if (!player) return;

    setIsLoadingChallenge(true);
    setErrorLoadingChallenge(null);
    setChallenge(null); // Clear previous challenge
    setSubmissionEvaluation(null);
    setCode("");

    try {
      const newChallenge = await generateCodingChallenge({ playerRank: player.rank, targetDifficulty: 'easy' });
      setChallenge(newChallenge);
      if (newChallenge.functionSignature) {
        // A simple placeholder generation, actual editor would be more complex
        setCode(`function solve() {\n  // Your code here\n}`);
      }
    } catch (error) {
      console.error("Failed to generate cooldown challenge:", error);
      setErrorLoadingChallenge("Failed to load challenge. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch a new cooldown challenge.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingChallenge(false);
    }
  }, [player, toast]);

  useEffect(() => {
    if (authLoading || !player) return;

    if (player.coins >= ELIGIBILITY_COIN_THRESHOLD) {
      setTimeCooldownActive(false);
      setChallenge(null);
      return;
    }

    const lastChallengeTimestamp = localStorage.getItem('lastCooldownChallengeTimestamp');
    if (lastChallengeTimestamp) {
      const lastTime = parseInt(lastChallengeTimestamp, 10);
      const cooldownEndTime = lastTime + COOLDOWN_DURATION_HOURS * 60 * 60 * 1000;
      const now = Date.now();

      if (now < cooldownEndTime) {
        setTimeCooldownActive(true);
        const updateTimer = () => {
          const timeLeftMs = cooldownEndTime - Date.now();
          if (timeLeftMs <= 0) {
            setTimeCooldownActive(false);
            localStorage.removeItem('lastCooldownChallengeTimestamp');
            if (player && player.coins < ELIGIBILITY_COIN_THRESHOLD) fetchCooldownChallenge();
            clearInterval(intervalId);
            return;
          }
          const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
          const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
          setCooldownTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        };
        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
      } else {
        localStorage.removeItem('lastCooldownChallengeTimestamp');
        setTimeCooldownActive(false);
        if (player.coins < ELIGIBILITY_COIN_THRESHOLD) fetchCooldownChallenge();
      }
    } else {
      setTimeCooldownActive(false);
      if (player.coins < ELIGIBILITY_COIN_THRESHOLD) fetchCooldownChallenge();
    }
  }, [authLoading, player, fetchCooldownChallenge]);


  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!player || !challenge || !code.trim()) {
      toast({ title: "Error", description: "Missing data for submission.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setSubmissionEvaluation(null);

    try {
      const evaluation = await evaluateCodeSubmission({
        playerCode: code,
        referenceSolution: challenge.solution,
        problemStatement: challenge.problemStatement,
        language: "javascript", // Cooldown challenges are JS for now
        difficulty: challenge.difficulty,
      });
      setSubmissionEvaluation(evaluation);

      if (evaluation.isPotentiallyCorrect) {
        const updatedPlayer = { ...player, coins: player.coins + COOLDOWN_REWARD_COINS };
        setPlayer(updatedPlayer);
        
        toast({
          title: "Challenge Completed!",
          description: `You've earned ${COOLDOWN_REWARD_COINS} coins! Your new balance: ${updatedPlayer.coins}`,
          className: "bg-green-500 text-white",
        });
        localStorage.setItem('lastCooldownChallengeTimestamp', Date.now().toString());
        setTimeCooldownActive(true);
        setChallenge(null); 
      } else {
        toast({
          title: "Incorrect Solution",
          description: "The AI assessed your solution as incorrect. See feedback below and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error evaluating cooldown submission:", error);
      toast({
        title: "Evaluation Error",
        description: "Could not evaluate your submission. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!player) {
    return <div className="text-center py-10">Loading player data...</div>;
  }

  if (player.coins >= ELIGIBILITY_COIN_THRESHOLD) {
    return (
        <div className="container mx-auto max-w-2xl py-8 text-center">
            <Card className="shadow-lg border-accent/20">
                <CardHeader>
                    <ShieldQuestion className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-3xl">Cooldown Challenge Unavailable</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-lg text-muted-foreground">
                        This challenge is only available when you have less than {ELIGIBILITY_COIN_THRESHOLD} coins.
                    </p>
                    <p className="text-md">
                        You currently have {player.coins} <CoinsIcon className="inline h-4 w-4 text-yellow-500 align-baseline"/>.
                    </p>
                    <Alert variant="default" className="bg-primary/10 border-primary/30 text-primary-foreground">
                        <Info className="h-5 w-5 text-primary" />
                        <AlertTitle className="text-primary">Ready for Action?</AlertTitle>
                        <AlertDescription className="text-primary/90">
                           Since you have enough coins, head over to the Arena to test your skills!
                        </AlertDescription>
                    </Alert>
                    <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Link href="/arena">Go to Arena</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (timeCooldownActive) {
    return (
        <div className="container mx-auto max-w-2xl py-8 text-center">
            <Card className="shadow-lg">
                <CardHeader>
                    <ShieldQuestion className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-3xl">Challenge on Cooldown</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg text-muted-foreground mb-2">
                        You've recently completed a cooldown challenge.
                    </p>
                    <p className="text-2xl font-semibold text-accent mb-6">
                        Next free challenge in: {cooldownTimeLeft || "Calculating..."}
                    </p>
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>How Cooldown Works</AlertTitle>
                        <AlertDescription>
                            If you run low on coins, you get one free challenge every {COOLDOWN_DURATION_HOURS} hours.
                            Solve it correctly to earn {COOLDOWN_REWARD_COINS} coins and get back into the game!
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (isLoadingChallenge) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Generating Your Cooldown Challenge...</h2>
        <p className="text-muted-foreground">Please wait a moment.</p>
      </div>
    );
  }

  if (errorLoadingChallenge) {
    return (
      <div className="container mx-auto max-w-2xl py-8 text-center">
        <Card className="shadow-lg border-destructive">
          <CardHeader>
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle className="text-3xl text-destructive">Error Loading Challenge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg text-muted-foreground">{errorLoadingChallenge}</p>
            <Button onClick={fetchCooldownChallenge} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!challenge) {
     return (
        <div className="container mx-auto max-w-2xl py-8 text-center">
            <Card className="shadow-lg">
                <CardHeader>
                    <ShieldQuestion className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-3xl">Cooldown Challenge</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg text-muted-foreground">Preparing your challenge. If this persists, try refreshing.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="items-center text-center bg-gradient-to-br from-primary/80 via-primary/60 to-primary/80 text-primary-foreground py-10 rounded-t-lg">
          <ShieldQuestion className="h-16 w-16 mb-4 opacity-90" />
          <CardTitle className="text-4xl font-bold">Cooldown Challenge</CardTitle>
          <CardDescription className="text-lg mt-2 text-primary-foreground/80">
            Solve this challenge (scaled to your rank) to earn {COOLDOWN_REWARD_COINS} coins!
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-6">
          <Card className="bg-muted/20">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-semibold text-foreground">Problem: {challenge.difficulty} difficulty</CardTitle>
                    <Badge className="capitalize bg-green-500 text-white hover:bg-green-600">{challenge.difficulty}</Badge>
                </div>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none text-foreground/90">
                <ScrollArea className="h-48 p-1">
                 {challenge.problemStatement.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-3 last:mb-0">{paragraph}</p>
                ))}
                </ScrollArea>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code-editor" className="block text-sm font-medium text-foreground mb-1">
                Your Solution (JavaScript):
              </label>
              <Textarea
                id="code-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`// Function signature might vary based on problem\n// Read the problem statement carefully!\n${challenge.functionSignature || 'function solve(params) {\n  // Your code here\n}'}`}
                className="min-h-[200px] font-mono text-sm bg-input/50 border-input focus:border-primary"
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || !code.trim()}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Solution for AI Evaluation
            </Button>
          </form>

          {submissionEvaluation && (
             <Card className="bg-muted/50 mt-6">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center"><Brain className="mr-2 h-5 w-5 text-primary"/> AI Analysis Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                        <span className="font-medium text-foreground">AI Assessment:</span>
                        <Badge variant={submissionEvaluation.isPotentiallyCorrect ? "default" : "destructive"} className={submissionEvaluation.isPotentiallyCorrect ? "bg-green-500 hover:bg-green-600 text-white" : ""}>
                            {submissionEvaluation.isPotentiallyCorrect ? "Likely Correct" : "Likely Incorrect"}
                        </Badge>
                    </div>
                    <p><span className="font-medium text-foreground">Explanation:</span> {submissionEvaluation.correctnessExplanation}</p>
                    <p><span className="font-medium text-foreground">Summary:</span> {submissionEvaluation.overallAssessment}</p>
                    
                    <h4 className="font-semibold text-md text-foreground pt-2">Quality Feedback:</h4>
                    <ScrollArea className="h-24 p-2 border rounded-md bg-background">
                        <pre className="whitespace-pre-wrap">{submissionEvaluation.codeQualityFeedback}</pre>
                    </ScrollArea>
                </CardContent>
              </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
