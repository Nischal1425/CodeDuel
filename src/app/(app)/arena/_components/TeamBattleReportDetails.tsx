
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, FileCode, XCircle } from "lucide-react";
import type { TeamBattle, TeamBattlePlayer } from "@/types";
import { CodeEditor } from "./CodeEditor";
import { cn } from "@/lib/utils";

function PlayerEvaluationCard({ player }: { player: TeamBattlePlayer }) {
    const evaluation = player.evaluation;

    if (!evaluation) {
        return (
             <Card className="opacity-60">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                            <AvatarImage src={player.avatarUrl} alt={player.username} data-ai-hint="avatar placeholder" />
                            <AvatarFallback>{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-lg">{player.username}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No submission or evaluation available.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <Avatar className="h-9 w-9 border">
                            <AvatarImage src={player.avatarUrl} alt={player.username} data-ai-hint="avatar placeholder" />
                            <AvatarFallback>{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-lg">{player.username}</CardTitle>
                    </div>
                     {evaluation.isPotentiallyCorrect ? 
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle className="mr-1 h-4 w-4"/> Correct</Badge> : 
                        <Badge variant="destructive"><XCircle className="mr-1 h-4 w-4"/> Incorrect</Badge>
                    }
                </div>
            </CardHeader>
             <CardContent>
                <Tabs defaultValue="feedback">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="feedback">AI Feedback</TabsTrigger>
                        <TabsTrigger value="code"><FileCode className="mr-1 h-4 w-4"/> Code</TabsTrigger>
                    </TabsList>
                    <TabsContent value="feedback" className="text-sm space-y-3 mt-4">
                        <p><strong className="text-foreground">Correctness:</strong> {evaluation.correctnessExplanation}</p>
                        <div><strong className="text-foreground">Time Complexity:</strong> <Badge variant="secondary">{evaluation.estimatedTimeComplexity}</Badge></div>
                        <div><strong className="text-foreground">Space Complexity:</strong> <Badge variant="secondary">{evaluation.estimatedSpaceComplexity}</Badge></div>
                        <p><strong className="text-foreground">Overall Assessment:</strong> {evaluation.overallAssessment}</p>
                        <div>
                            <strong className="text-foreground">Code Quality Feedback:</strong>
                            <ScrollArea className="h-24 mt-1 rounded-md border bg-background/50 p-2 text-xs">
                                <pre className="whitespace-pre-wrap font-sans">{evaluation.codeQualityFeedback}</pre>
                            </ScrollArea>
                        </div>
                    </TabsContent>
                    <TabsContent value="code" className="mt-2">
                        <div className="h-64 w-full border rounded-md overflow-hidden">
                            <CodeEditor
                            value={player.code || ''}
                            language={player.language}
                            readOnly={true}
                            height="256px"
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}


function TeamReportTab({ team, teamName }: { team: TeamBattlePlayer[], teamName: string }) {
    return (
        <Accordion type="multiple" className="w-full space-y-4">
            {team.map((player, index) => (
                 <AccordionItem value={`player-${index}`} key={player.id} className="border-b-0">
                    <Card className="bg-muted/30">
                        <AccordionTrigger className="p-4 hover:no-underline">
                             <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={player.avatarUrl} alt={player.username} data-ai-hint="avatar placeholder" />
                                        <AvatarFallback>{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-semibold">{player.username}</span>
                                </div>
                                 {player.evaluation?.isPotentiallyCorrect ? 
                                    <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle className="mr-1 h-4 w-4"/> Correct</Badge> : 
                                    <Badge variant="destructive"><XCircle className="mr-1 h-4 w-4"/> Incorrect</Badge>
                                }
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-0">
                           <PlayerEvaluationCard player={player} />
                        </AccordionContent>
                    </Card>
                </AccordionItem>
            ))}
        </Accordion>
    );
}


export function TeamBattleReportDetails({ battle }: { battle: TeamBattle }) {
    return (
        <Tabs defaultValue="team1">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="team1" className={cn(battle.winnerTeam === 'team1' && 'text-green-600')}>Blue Team</TabsTrigger>
                <TabsTrigger value="team2" className={cn(battle.winnerTeam === 'team2' && 'text-red-600')}>Red Team</TabsTrigger>
            </TabsList>
            <TabsContent value="team1" className="mt-4">
                <TeamReportTab team={battle.team1} teamName="Blue" />
            </TabsContent>
            <TabsContent value="team2" className="mt-4">
                 <TeamReportTab team={battle.team2} teamName="Red" />
            </TabsContent>
        </Tabs>
    );
}

    