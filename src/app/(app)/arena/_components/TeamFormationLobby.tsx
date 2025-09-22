

"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, LogOut, Loader2 } from 'lucide-react';
import type { Player, TeamLobby } from '@/types';
import { cn } from '@/lib/utils';


interface TeamFormationLobbyProps {
  player: Player | null;
  lobbyData: TeamLobby;
  onJoinTeam: (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4') => void;
  onLeave: () => void;
}

const SLOTS: ('1' | '2' | '3' | '4')[] = ['1', '2', '3', '4'];


function TeamSlot({ slot, playerInfo, onJoin, teamName, disabled }: { slot: '1' | '2' | '3' | '4'; playerInfo: { id: string; username: string; avatarUrl?: string; rating: number; } | null; onJoin: (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4') => void; teamName: 'blue' | 'red'; disabled?: boolean }) {
    const canJoin = !playerInfo && !disabled;

    return (
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-muted">
                    {playerInfo ? (
                        <>
                         <AvatarImage src={playerInfo.avatarUrl} alt={playerInfo.username} data-ai-hint="avatar placeholder" />
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
            {canJoin ? (
                 <Button size="sm" variant="secondary" onClick={() => onJoin(teamName, slot)}>Join</Button>
            ) : playerInfo ? (
                <span className="text-xs font-medium text-green-500">Ready</span>
            ) : null}
        </div>
    );
}


function TeamCard({ teamName, teamData, onJoin, disabled }: { teamName: 'Blue' | 'Red'; teamData: TeamLobby['blue'] | TeamLobby['red']; onJoin: (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4') => void; disabled?: boolean; }) {
    const teamColor = teamName === 'Blue' ? 'blue' : 'red';
    
    return (
        <Card className={cn("flex flex-col", `border-${teamColor}-500`)}>
            <CardHeader className={cn("text-center text-white rounded-t-lg", `bg-${teamColor}-600`)}>
                <CardTitle className="text-2xl">{teamName} Team</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {SLOTS.map(slot => <TeamSlot key={slot} slot={slot} playerInfo={teamData[slot]} onJoin={onJoin} teamName={teamName.toLowerCase() as 'blue' | 'red'} disabled={disabled} />)}
            </CardContent>
        </Card>
    );
}


export function TeamFormationLobby({ player, lobbyData, onJoinTeam, onLeave }: TeamFormationLobbyProps) {
    if (!player || !lobbyData) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <p className="mb-4">Loading player data...</p><Loader2 className="h-8 w-8 animate-spin"/>
            </div>
        );
    }
    
    const allPlayersInLobby = [
        ...Object.values(lobbyData.blue || {}),
        ...Object.values(lobbyData.red || {})
    ].filter(p => p !== null);

    const isPlayerInLobby = allPlayersInLobby.some(p => p?.id === player.id);
    const totalPlayers = allPlayersInLobby.length;

    return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center">
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <Users className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-3xl font-bold">Team Formation</CardTitle>
                    <CardDescription className="text-lg">Join a team to start the 4v4 DeathMatch.</CardDescription>
                </CardHeader>
                <CardContent className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <TeamCard teamName="Blue" teamData={lobbyData.blue || {}} onJoin={onJoinTeam} disabled={isPlayerInLobby}/>
                        <TeamCard teamName="Red" teamData={lobbyData.red || {}} onJoin={onJoinTeam} disabled={isPlayerInLobby}/>
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                    <p className="text-sm text-muted-foreground">Waiting for more players... ({totalPlayers}/8)</p>
                    <Button variant="outline" onClick={onLeave}>
                        <LogOut className="mr-2 h-4 w-4" /> Leave Lobby
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}


    
