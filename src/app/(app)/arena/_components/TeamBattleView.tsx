
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Swords, User, Flag, Users } from 'lucide-react';
import type { Player, TeamBattle, SupportedLanguage, TeamLobbyPlayer } from '@/types';
import { cn } from '@/lib/utils';
import { GameTimer } from './GameTimer';
import { ProblemDisplay } from './ProblemDisplay';
import { CodeEditor } from './CodeEditor';

interface TeamBattleViewProps {
    battleData: TeamBattle;
    player: Player;
    timeRemaining: number;
    code: string;
    language: SupportedLanguage;
    onCodeChange: (newCode: string) => void;
    onLanguageChange: (newLang: SupportedLanguage) => void;
    onSubmitCode: (e?: React.FormEvent) => void;
    onTimeUp: () => void;
    onForfeit: () => void;
}

function TeamRoster({ teamName, team, score, color }: { teamName: string, team: TeamLobbyPlayer[], score: number, color: 'blue' | 'red' }) {
    return (
        <Card className={cn("border-2", color === 'blue' ? 'border-blue-500' : 'border-red-500')}>
            <CardHeader className={cn("p-3 text-center", color === 'blue' ? 'bg-blue-600' : 'bg-red-600')}>
                <CardTitle className="text-xl text-white">{teamName} Team</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
                <div className="text-center mb-2">
                    <p className="text-2xl font-bold">{score}</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                </div>
                {team.map(p => (
                    <div key={p.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm">
                        <Avatar className="h-8 w-8 border">
                            <AvatarImage src={p.avatarUrl} alt={p.username} data-ai-hint="avatar placeholder" />
                            <AvatarFallback>{p.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{p.username}</span>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}


export function TeamBattleView({
    battleData,
    player,
    timeRemaining,
    code,
    language,
    onCodeChange,
    onLanguageChange,
    onSubmitCode,
    onTimeUp,
    onForfeit
}: TeamBattleViewProps) {
      
    // Determine which team the current player is on
    const playerTeam = battleData.team1.some(p => p.id === player.id) ? 'team1' : 'team2';
    const me = playerTeam === 'team1' ? battleData.team1.find(p => p.id === player.id) : battleData.team2.find(p => p.id === player.id);

    return (
        <div className="flex flex-col gap-4 h-full p-4 md:p-6">
          <Card className="shadow-md shrink-0">
             <CardContent className="p-3 flex justify-around items-center text-sm">
                <div className="flex items-center gap-2"><Users className="h-8 w-8 text-blue-500" /><p className="font-semibold text-foreground">Blue Team</p></div>
                <div className="text-center"><Swords className="h-6 w-6 text-muted-foreground mx-auto"/><p className="text-xs text-primary font-medium">{battleData.difficulty} - 4v4</p></div>
                <div className="flex items-center gap-2"><Users className="h-8 w-8 text-red-500" /><p className="font-semibold text-foreground">Red Team</p></div>
             </CardContent>
          </Card>

          <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-0">
              {/* Left Column: Teams & Problem */}
              <div className="lg:w-1/3 flex flex-col gap-4">
                 <TeamRoster teamName="Blue" team={battleData.team1} score={battleData.team1Score} color="blue" />
                 <TeamRoster teamName="Red" team={battleData.team2} score={battleData.team2Score} color="red" />
              </div>

              {/* Right Column: Problem & Editor */}
              <div className="lg:w-2/3 flex flex-col gap-4">
                  <Card className="flex-1 flex flex-col shadow-xl overflow-hidden min-h-0">
                    <CardHeader className="bg-card-foreground/5">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-2xl text-primary">Coding Challenge</CardTitle>
                            <GameTimer initialTime={timeRemaining} onTimeUp={onTimeUp} />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-grow overflow-y-auto">
                        <ProblemDisplay question={battleData.question} />
                    </CardContent>
                  </Card>

                  <Card className="flex-1 flex flex-col shadow-xl overflow-hidden min-h-0">
                    <CardHeader className="bg-card-foreground/5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2"><CardTitle className="text-2xl">Your Solution</CardTitle></div>
                          <Select value={language} onValueChange={onLanguageChange}>
                              <SelectTrigger className="w-[180px] bg-background"><SelectValue placeholder="Select language" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="javascript">JavaScript</SelectItem>
                                <SelectItem value="python">Python</SelectItem>
                                <SelectItem value="cpp">C++</SelectItem>
                              </SelectContent>
                          </Select>
                        </div>
                    </CardHeader>
                    <div className="flex-grow min-h-0">
                        <CodeEditor
                            value={code}
                            onChange={onCodeChange}
                            language={language}
                        />
                    </div>
                     <div className="p-4 border-t flex flex-col gap-2">
                        <Button onClick={onSubmitCode} disabled={!code.trim()} className="w-full">
                            Submit Code
                        </Button>
                        <Button variant="outline" onClick={onForfeit} className="w-full">
                            <Flag className="mr-2 h-4 w-4" /> Forfeit Match
                        </Button>
                     </div>
                  </Card>
              </div>
          </div>
        </div>
    );
}
