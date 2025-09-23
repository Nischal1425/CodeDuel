
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Swords, Flag, Brain, Coins, FileCode, XCircle } from 'lucide-react';
import type { Player, Battle } from '@/types';
import { CodeEditor } from './CodeEditor';
import { cn } from '@/lib/utils';

interface GameOverReportProps {
    battleData: Battle | null;
    player: Player;
    onFindNewMatch: () => void;
}


export function GameOverReport({ battleData, player, onFindNewMatch }: GameOverReportProps) {
    if (!battleData) {
        return (
            <div className="flex items-center justify-center h-full">
                <p>No battle report available.</p>
            </div>
        );
    }
    const outcome = battleData.winnerId === player?.id ? 'win' : (!battleData.winnerId ? 'draw' : 'loss');
    let title = "Match Over";
    let message = "";
    let icon: React.ReactNode = <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;
    const opponent = battleData.player1.id === player?.id ? battleData.player2 : battleData.player1;

    if(battleData.status === 'forfeited'){
        title = outcome === 'win' ? "Victory by Forfeit!" : "Match Forfeited";
        message = outcome === 'win' ? `Your opponent forfeited. You won the wager!` : `You forfeited the match and lost your wager.`;
        icon = outcome === 'win' ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4"/> : <Flag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />;
    } else { // 'completed'
        title = outcome === 'win' ? 'Victory!' : (outcome === 'draw' ? "It's a Draw!" : "Defeat!");
        message = outcome === 'win' ? `You defeated ${opponent?.username || 'your opponent'}!` : (outcome === 'draw' ? `The duel ended in a draw.` : `${opponent?.username || 'Your opponent'} won the duel.`);
        icon = outcome === 'win' ? <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4"/> : (outcome === 'draw' ? <Swords className="h-16 w-16 text-yellow-500 mx-auto mb-4"/> : <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4"/>);
    }
    
    const comparisonResult = battleData.comparisonResult;
    const player1 = battleData.player1;
    const player2 = battleData.player2!;
    const player1Eval = comparisonResult?.player1Evaluation;
    const player2Eval = comparisonResult?.player2Evaluation;

    return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center p-4">
            <Card>
                <CardHeader className="text-center">
                    {icon}
                    <CardTitle className="text-3xl font-bold mb-2">{title}</CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">{message}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {comparisonResult && player1Eval && player2Eval && (
                        <Accordion type="single" collapsible className="w-full" defaultValue="comparison-details">
                        <AccordionItem value="comparison-details">
                            <AccordionTrigger className="text-lg hover:no-underline"><Brain className="mr-2 h-5 w-5 text-primary"/> Detailed AI Duel Report</AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                                <Card className="bg-muted/30">
                                <CardHeader>
                                    <CardTitle className="text-xl">Duel Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <p><strong className="text-foreground">Winning Reason:</strong> {comparisonResult.winningReason}</p>
                                    <p><strong className="text-foreground">Comparison:</strong> {comparisonResult.comparisonSummary}</p>
                                </CardContent>
                                </Card>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {[
                                    {player: player1, evaluation: player1Eval, title: `${player1.username} ${player1.id === player?.id ? '(You)' : ''}`},
                                    {player: player2, evaluation: player2Eval, title: `${player2.username} ${player2.id === player?.id ? '(You)' : ''}`}
                                ].map((data, index) => (
                                    <Card key={index} className={cn("flex flex-col", battleData.winnerId === data.player.id ? 'border-green-500' : battleData.winnerId && 'opacity-70')}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center justify-between">
                                        <span>{data.title}</span>
                                        {data.evaluation.isPotentiallyCorrect ? 
                                            <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle className="mr-1 h-4 w-4"/> Correct</Badge> : 
                                            <Badge variant="destructive"><XCircle className="mr-1 h-4 w-4"/> Incorrect</Badge>
                                        }
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <Tabs defaultValue="feedback">
                                            <TabsList className="grid w-full grid-cols-2">
                                                <TabsTrigger value="feedback">AI Feedback</TabsTrigger>
                                                <TabsTrigger value="code"><FileCode className="mr-1 h-4 w-4"/> Code</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="feedback" className="text-sm space-y-3 mt-4">
                                                <p><strong className="text-foreground">Correctness:</strong> {data.evaluation.correctnessExplanation}</p>
                                                <div><strong className="text-foreground">Time Complexity:</strong> <Badge variant="secondary">{data.evaluation.estimatedTimeComplexity}</Badge></div>
                                                <div><strong className="text-foreground">Space Complexity:</strong> <Badge variant="secondary">{data.evaluation.estimatedSpaceComplexity}</Badge></div>
                                                <p><strong className="text-foreground">Overall Assessment:</strong> {data.evaluation.overallAssessment}</p>
                                                <div>
                                                    <strong className="text-foreground">Code Quality Feedback:</strong>
                                                    <ScrollArea className="h-24 mt-1 rounded-md border bg-background/50 p-2 text-xs">
                                                        <pre className="whitespace-pre-wrap font-sans">{data.evaluation.codeQualityFeedback}</pre>
                                                    </ScrollArea>
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="code" className="mt-2">
                                                <div className="h-64 w-full border rounded-md overflow-hidden">
                                                    <CodeEditor
                                                    value={data.player.code || ''}
                                                    language={data.player.language}
                                                    readOnly={true}
                                                    height="256px"
                                                    />
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                    </Card>
                                ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        </Accordion>
                    )}
                    <div className="text-center text-muted-foreground">Your coins: {player?.coins ?? 0} <Coins className="inline h-4 w-4 text-yellow-500 align-baseline"/></div>
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/dashboard">Return to Dashboard</Link>
                    </Button>
                    <Button onClick={onFindNewMatch} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Find New Match
                    </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
