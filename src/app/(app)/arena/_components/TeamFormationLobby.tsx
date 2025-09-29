

"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, LogOut, Loader2 } from 'lucide-react';
import type { Player, TeamLobby, TeamLobbyPlayer } from '@/types';
import { cn } from '@/lib/utils';
import placeholderImages from '@/lib/placeholder-images.json';
import { Progress } from '@/components/ui/progress';


const SLOTS: ('1' | '2' | '3' | '4')[] = ['1', '2', '3', '4'];


function TeamSlot({ slot, playerInfo }: { slot: '1' | '2' | '3' | '4'; playerInfo: TeamLobbyPlayer | null; }) {
    
    const getImage = (p: TeamLobbyPlayer | null) => {
        if (!p) return "";
        if (p.id.startsWith('bot_')) {
            const botName = p.id.split('_')[1];
            return placeholderImages.bots[botName as keyof typeof placeholderImages.bots] || "";
        }
        return p.avatarUrl || placeholderImages.defaultUser;
    }

    return (
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-muted">
                    {playerInfo ? (
                        <>
                         <AvatarImage src={getImage(playerInfo)} alt={playerInfo.username} data-ai-hint="avatar placeholder" />
                         <AvatarFallback>{playerInfo.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </>
                    ) : (
                        <AvatarFallback>?</AvatarFallback>
                    )}
                </Avatar>
                <div className="flex flex-col">
                   <span className="font-semibold text-sm text-foreground">{playerInfo?.username || `Slot ${slot}`}</span>
                   {playerInfo && <span className="text-xs text-muted-foreground">Rating: {playerInfo.rating}</span>}
                </div>
            </div>
             {playerInfo ? (
                <span className="text-xs font-medium text-green-500">Ready</span>
            ) : <span className="text-xs text-muted-foreground">Searching...</span>}
        </div>
    );
}


function TeamCard({ teamName, teamData }: { teamName: 'Blue' | 'Red'; teamData: TeamLobby['teams']['blue'] | TeamLobby['teams']['red']}) {
    const teamColor = teamName === 'Blue' ? 'blue' : 'red';
    
    return (
        <Card className={cn("flex flex-col", `border-${teamColor}-500`)}>
            <CardHeader className={cn("text-center text-white rounded-t-lg", `bg-${teamColor}-600`)}>
                <CardTitle className="text-2xl">{teamName} Team</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {SLOTS.map(slot => <TeamSlot key={slot} slot={slot} playerInfo={teamData[slot]} />)}
            </CardContent>
        </Card>
    );
}


export function TeamFormationLobby({ player, lobbyData, onLeave }: { player: Player | null; lobbyData: TeamLobby; onLeave: () => void; }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (progress < 100) {
                setProgress(p => p + (100 / 5)); // 5 second countdown
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [progress]);


    if (!player || !lobbyData) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <p className="mb-4">Loading player data...</p><Loader2 className="h-8 w-8 animate-spin"/>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center">
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <Users className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-3xl font-bold">Teams Have Been Formed!</CardTitle>
                    <CardDescription className="text-lg">Get ready for battle. The match is starting soon.</CardDescription>
                </CardHeader>
                <CardContent className="mt-6">
                     <div className="mb-4">
                        <Progress value={progress} />
                        <p className="text-center text-sm mt-2 text-muted-foreground">Starting in {5 - Math.floor(progress / (100 / 5))}s...</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <TeamCard teamName="Blue" teamData={lobbyData.teams.blue || {}} />
                        <TeamCard teamName="Red" teamData={lobbyData.teams.red || {}} />
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                    <Button variant="outline" onClick={onLeave}>
                        <LogOut className="mr-2 h-4 w-4" /> Leave
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

    