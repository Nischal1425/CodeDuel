
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldQuestion, Coins, PartyPopper, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { ProblemDisplay } from '../arena/_components/ProblemDisplay';
import { CodeEditor } from '../arena/_components/CodeEditor';
import { generateCodingChallenge, type GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import { evaluateCodeSubmission, type EvaluateCodeSubmissionOutput } from '@/ai/flows/evaluate-code-submission';
import type { SupportedLanguage } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MIN_COINS_FOR_DUEL = 50;
const COOLDOWN_REWARD = 100;
const COOLDOWN_HOURS = 24;
const DEFAULT_LANGUAGE: SupportedLanguage = "javascript";

type ChallengeState = 'idle' | 'generating' | 'ready' | 'evaluating' | 'completed';

export default function CooldownChallengePage() {
  const { player } = useAuth();
  const { toast } = useToast();
  
  const [challengeState, setChallengeState] = useState<ChallengeState>('idle');
  const [challenge, setChallenge] = useState<GenerateCodingChallengeOutput | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluateCodeSubmissionOutput | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  const lastCompletedDate = player?.lastCooldownCompletedAt?.toDate();
  const isCooledDown = !lastCompletedDate || (new Date().getTime() - lastCompletedDate.getTime()) > (COOLDOWN_HOURS * 60 * 60 * 1000);
  const isEligible = player && player.coins < MIN_COINS_FOR_DUEL && isCooledDown;

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
        return `#include <iostream>\n\nclass Solution {\npublic:\n  ${methodSignature}\n};\n`;
    }
    return `// Placeholder for ${selectedLang}.`;
  };
  
  useEffect(() => {
    if (challenge) {
        setCode(getCodePlaceholder(language, challenge));
    }
  }, [challenge, language]);

  const handleGenerateChallenge = async () => {
    if (!player) return;

    setChallengeState('generating');
    try {
      const generatedChallenge = await generateCodingChallenge({
        playerRank: player.rank,
        targetDifficulty: player.rank < 10 ? 'easy' : 'medium',
      });
      setChallenge(generatedChallenge);
      setChallengeState('ready');
    } catch (error) {
      console.error("Failed to generate challenge:", error);
      toast({ title: "Error", description: "Could not generate a challenge. Please try again later.", variant: "destructive" });
      setChallengeState('idle');
    }
  };

  const handleEvaluateSubmission = async () => {
    if (!player || !challenge) return;

    setChallengeState('evaluating');
    try {
        const evalResult = await evaluateCodeSubmission({
            playerCode: code,
            language: language,
            problemStatement: challenge.problemStatement,
            referenceSolution: challenge.solution,
            difficulty: challenge.difficulty,
        });
        setEvaluation(evalResult);

        if (evalResult.isPotentiallyCorrect) {
            const playerRef = doc(db, "players", player.id);
            await updateDoc(playerRef, {
                coins: player.coins + COOLDOWN_REWARD,
                lastCooldownCompletedAt: serverTimestamp(),
            });
            toast({
                title: "Success!",
                description: `You solved the challenge and earned ${COOLDOWN_REWARD} coins!`,
                className: 'bg-green-500 text-white',
            });
        }
        setChallengeState('completed');

    } catch (error) {
        console.error("Failed to evaluate submission:", error);
        toast({ title: "Evaluation Error", description: "Could not evaluate your code. Please try again.", variant: "destructive" });
        setChallengeState('ready');
    }
  };


  const renderContent = () => {
    if (challengeState === 'generating' || challengeState === 'evaluating') {
      return (
        <div className="flex flex-col items-center justify-center h-48">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">
            {challengeState === 'generating' ? 'Generating your challenge...' : 'AI is evaluating your code...'}
          </p>
        </div>
      );
    }
    
    if (challengeState === 'ready' && challenge) {
        return (
             <div className="flex flex-col lg:flex-row gap-4">
                <div className="lg:w-1/2">
                    <ProblemDisplay question={challenge} />
                </div>
                <div className="lg:w-1/2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Solution</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[400px] p-0">
                            <CodeEditor 
                                value={code}
                                onChange={setCode}
                                language={language}
                                height="400px"
                            />
                        </CardContent>
                        <CardFooter>
                           <Button onClick={handleEvaluateSubmission} className="w-full mt-4">Submit for Evaluation</Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        );
    }
    
    if (challengeState === 'completed' && evaluation) {
      return (
        <Alert variant={evaluation.isPotentiallyCorrect ? 'default' : 'destructive'} className={evaluation.isPotentiallyCorrect ? 'border-green-500' : ''}>
          {evaluation.isPotentiallyCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertTitle className="text-xl">
            {evaluation.isPotentiallyCorrect ? 'Challenge Solved!' : 'Incorrect Solution'}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>{evaluation.correctnessExplanation}</p>
            {evaluation.isPotentiallyCorrect && <p className="font-bold text-green-600">You have been awarded {COOLDOWN_REWARD} coins!</p>}
            <Button onClick={() => setChallengeState('idle')}>Back to Cooldown Home</Button>
          </AlertDescription>
        </Alert>
      );
    }


    return (
        <div className="text-center space-y-6">
            {isEligible ? (
                <>
                    <p>
                        You are low on coins! Complete this daily challenge to earn enough to get back into the arena.
                    </p>
                    <Button size="lg" onClick={handleGenerateChallenge}>
                        <Coins className="mr-2 h-5 w-5"/> Start Free Challenge
                    </Button>
                </>
            ) : (
                <>
                    <p>
                        This feature is for players with less than {MIN_COINS_FOR_DUEL} coins who need to earn their way back into the duels.
                    </p>
                    {player && player.coins >= MIN_COINS_FOR_DUEL && 
                        <Alert variant="default" className="text-left">
                            <PartyPopper className="h-4 w-4" />
                            <AlertTitle>You're Good to Go!</AlertTitle>
                            <AlertDescription>
                                You have enough coins to enter the arena. Good luck!
                            </AlertDescription>
                        </Alert>
                    }
                    {!isCooledDown &&
                         <Alert variant="destructive" className="text-left">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Challenge on Cooldown</AlertTitle>
                            <AlertDescription>
                                You have already completed a challenge recently. Please come back later.
                            </AlertDescription>
                        </Alert>
                    }
                </>
            )}
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Card className="shadow-lg border-accent/20">
        <CardHeader className="text-center">
          <ShieldQuestion className="h-16 w-16 text-accent mx-auto mb-4" />
          <CardTitle className="text-4xl font-bold">Cooldown Challenge</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            A daily puzzle to keep your skills sharp and earn rewards when you're low on funds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {player ? renderContent() : <Loader2 className="h-8 w-8 animate-spin mx-auto" />}
        </CardContent>
      </Card>
    </div>
  );
}
