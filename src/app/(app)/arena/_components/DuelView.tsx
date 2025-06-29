"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Swords, UserSquare2, Flag } from 'lucide-react';
import type { Player, Battle, SupportedLanguage } from '@/types';
import { GameTimer } from './GameTimer';
import { ProblemDisplay } from './ProblemDisplay';
import { CodeEditor } from './CodeEditor';

interface DuelViewProps {
    battleData: Battle;
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

export function DuelView({
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
}: DuelViewProps) {
    const opponent = battleData.player1.id === player.id ? battleData.player2 : battleData.player1;
    const me = battleData.player1.id === player.id ? battleData.player1 : battleData.player2;
      
    if (!opponent) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/>Waiting for opponent...</div>;

    return (
        <div className="flex flex-col gap-4 h-full p-4 md:p-6">
          <Card className="shadow-md shrink-0">
             <CardContent className="p-3 flex justify-around items-center text-sm">
                {/* Player 1 Info */}
                <div className="flex items-center gap-2"><UserSquare2 className="h-8 w-8 text-blue-500" /><p className="font-semibold text-foreground">{battleData.player1.username}</p></div>
                <div className="text-center"><Swords className="h-6 w-6 text-muted-foreground mx-auto"/><p className="text-xs text-primary font-medium">{battleData.difficulty}</p></div>
                {/* Player 2 Info */}
                <div className="flex items-center gap-2"><UserSquare2 className="h-8 w-8 text-red-500" /><p className="font-semibold text-foreground">{battleData.player2?.username || '???'}</p></div>
             </CardContent>
          </Card>

          <div className="flex flex-col lg:flex-row gap-6 flex-grow min-h-0">
              <Card className="lg:w-1/2 flex flex-col shadow-xl overflow-hidden">
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

              <Card className="lg:w-1/2 flex flex-col shadow-xl overflow-hidden">
                <CardHeader className="bg-card-foreground/5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><CardTitle className="text-2xl">Your Solution</CardTitle></div>
                      <Select value={language} onValueChange={onLanguageChange} disabled={me?.hasSubmitted}>
                          <SelectTrigger className="w-[180px] bg-background"><SelectValue placeholder="Select language" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="cpp">C++</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    {opponent.hasSubmitted && !me?.hasSubmitted && <p className="mt-2 text-sm text-yellow-600 animate-pulse">Opponent has submitted!</p>}
                    {me?.hasSubmitted && !opponent.hasSubmitted && <p className="mt-2 text-sm text-blue-600">Your code is submitted. Waiting for opponent...</p>}
                </CardHeader>
                <div className="flex-grow min-h-0">
                    <CodeEditor
                        value={code}
                        onChange={onCodeChange}
                        language={language}
                        readOnly={me?.hasSubmitted}
                    />
                </div>
                 <div className="p-4 border-t flex flex-col gap-2">
                    <Button onClick={onSubmitCode} disabled={me?.hasSubmitted || !code.trim()} className="w-full">
                        {me?.hasSubmitted ? "Code Submitted" : "Submit for Final AI Duel"}
                    </Button>
                    <Button variant="outline" onClick={onForfeit} disabled={me?.hasSubmitted} className="w-full">
                        <Flag className="mr-2 h-4 w-4" /> Forfeit Match
                    </Button>
                 </div>
              </Card>
          </div>
        </div>
    );
}
