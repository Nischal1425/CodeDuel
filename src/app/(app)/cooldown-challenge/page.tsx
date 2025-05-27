
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldQuestion, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';

const cooldownProblem = {
  title: "Sum of Two Numbers",
  statement: "Write a function that takes two integers, `a` and `b`, as input and returns their sum.",
  exampleInput: "a = 5, b = 7",
  exampleOutput: "12",
  entryCoins: 50, 
};

const COOLDOWN_DURATION_HOURS = 3;

export default function CooldownChallengePage() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<"success" | "failure" | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState("");
  
  useEffect(() => {
    const lastChallengeTimestamp = localStorage.getItem('lastCooldownChallengeTimestamp');
    if (lastChallengeTimestamp) {
      const lastTime = parseInt(lastChallengeTimestamp, 10);
      const cooldownEndTime = lastTime + COOLDOWN_DURATION_HOURS * 60 * 60 * 1000;
      const now = Date.now();

      if (now < cooldownEndTime) {
        setCooldownActive(true);
        const updateTimer = () => {
          const timeLeftMs = cooldownEndTime - Date.now();
          if (timeLeftMs <= 0) {
            setCooldownActive(false);
            localStorage.removeItem('lastCooldownChallengeTimestamp');
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
      }
    }
  }, [cooldownActive]); // Rerun if cooldownActive changes (e.g. after successful submission)


  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionResult(null);

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (code.includes("return") && (code.includes("a + b") || code.includes("a+b"))) {
      setSubmissionResult("success");
      toast({
        title: "Challenge Completed!",
        description: `You've earned ${cooldownProblem.entryCoins} coins!`,
        className: "bg-green-500 text-white",
      });
      localStorage.setItem('lastCooldownChallengeTimestamp', Date.now().toString());
      setCooldownActive(true); 
    } else {
      setSubmissionResult("failure");
      toast({
        title: "Incorrect Solution",
        description: "Please review your code and try again.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  if (cooldownActive) {
    return (
        <div className="container mx-auto max-w-2xl py-8 text-center">
            <Card className="shadow-lg">
                <CardHeader>
                    <ShieldQuestion className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-3xl">Challenge on Cooldown</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg text-muted-foreground mb-2">
                        You've recently attempted the cooldown challenge.
                    </p>
                    <p className="text-2xl font-semibold text-accent mb-6">
                        Next free challenge in: {cooldownTimeLeft || "Calculating..."}
                    </p>
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>How Cooldown Works</AlertTitle>
                        <AlertDescription>
                            If you run out of coins and lose a match, you get one free challenge every {COOLDOWN_DURATION_HOURS} hours.
                            Solve it correctly to earn entry coins and get back into the game!
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
  }


  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="items-center text-center bg-gradient-to-br from-primary/80 via-primary/60 to-primary/80 text-primary-foreground py-10 rounded-t-lg">
          <ShieldQuestion className="h-16 w-16 mb-4 opacity-90" />
          <CardTitle className="text-4xl font-bold">Cooldown Challenge</CardTitle>
          <CardDescription className="text-lg mt-2 text-primary-foreground/80">
            Out of coins? Solve this challenge to earn {cooldownProblem.entryCoins} entry coins!
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-2">{cooldownProblem.title}</h3>
            <p className="text-muted-foreground mb-4">{cooldownProblem.statement}</p>
            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm font-medium">Example:</p>
              <p className="text-sm">Input: <code className="font-mono bg-background px-1 rounded">{cooldownProblem.exampleInput}</code></p>
              <p className="text-sm">Output: <code className="font-mono bg-background px-1 rounded">{cooldownProblem.exampleOutput}</code></p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code-editor" className="block text-sm font-medium text-foreground mb-1">
                Your Solution (JavaScript):
              </label>
              <Textarea
                id="code-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={`function solve(a, b) {\n  // Your code here\n}`}
                className="min-h-[200px] font-mono text-sm bg-input/50 border-input focus:border-primary"
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || !code.trim()}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit Solution
            </Button>
          </form>

          {submissionResult === "success" && (
            <Alert variant="default" className="bg-green-50 border-green-300 text-green-700">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="font-semibold">Challenge Passed!</AlertTitle>
              <AlertDescription>
                Congratulations! {cooldownProblem.entryCoins} coins have been added to your account.
                You can now join new duels. Cooldown period has started.
              </AlertDescription>
            </Alert>
          )}
          {submissionResult === "failure" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="font-semibold">Incorrect Solution</AlertTitle>
              <AlertDescription>
                Your solution didn't pass the tests. Please review your code and try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
