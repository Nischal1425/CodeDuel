"use client";

import type { FormEvent } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle, Send } from 'lucide-react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { generateCodingChallenge } from '@/ai/flows/generate-coding-challenge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { GameTimer } from './_components/GameTimer';
import { ProblemDisplay } from './_components/ProblemDisplay';

const DEFAULT_LANGUAGE = "javascript";

export default function ArenaPage() {
  const { player } = useAuth();
  const { toast } = useToast();
  const [question, setQuestion] = useState<GenerateCodingChallengeOutput | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [errorLoadingQuestion, setErrorLoadingQuestion] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds

  const fetchQuestion = useCallback(async () => {
    if (!player) return;
    setIsLoadingQuestion(true);
    setErrorLoadingQuestion(null);
    setQuestion(null);
    try {
      const challenge = await generateCodingChallenge({ playerRank: player.rank });
      setQuestion(challenge);
      // Set time limit based on difficulty
      let minutes = 5; // Default medium
      if (challenge.difficulty === 'easy') minutes = 3; // 2-5 PRD
      else if (challenge.difficulty === 'hard') minutes = 10; // 10-15 PRD
      setTimeRemaining(minutes * 60);
    } catch (error) {
      console.error("Failed to generate coding challenge:", error);
      setErrorLoadingQuestion("Failed to load challenge. Please try refreshing.");
      toast({
        title: "Error",
        description: "Could not fetch a new coding challenge. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [player, toast]);

  useEffect(() => {
    if (player) {
      fetchQuestion();
    }
  }, [player, fetchQuestion]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast({ title: "Empty Code", description: "Please write some code before submitting.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setSubmissionStatus('idle');
    // Mock submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Mock evaluation
    const isCorrect = Math.random() > 0.3; // 70% chance of success for mock
    if (isCorrect) {
      setSubmissionStatus('success');
      toast({ title: "Submission Successful!", description: "Your solution was correct.", className: "bg-green-500 text-white" });
      // In a real app, handle win/loss, coin updates, navigate away or show results
    } else {
      setSubmissionStatus('error');
      toast({ title: "Submission Failed", description: "Your solution was incorrect. Try again!", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleTimeUp = () => {
    toast({
      title: "Time's Up!",
      description: "The timer for this challenge has expired.",
      variant: "destructive",
    });
    // Handle time up logic (e.g., auto-submit or mark as loss)
    // For now, just disable submission
    setIsSubmitting(true); // effectively disables submission
  };


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
        <Button onClick={fetchQuestion}>Try Again</Button>
      </div>
    );
  }

  if (!question) {
    // This case should ideally be handled by loader or error state if player is present
    return <div className="flex items-center justify-center h-full"><p>No challenge loaded.</p></div>;
  }
  
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)] max-h-[calc(100vh-10rem)]">
      {/* Problem Statement Panel */}
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

      {/* Code Editor Panel */}
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
          <CardDescription>Write your code below. Good luck!</CardDescription>
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
  );
}
