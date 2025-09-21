
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, LogOut, Loader2 } from 'lucide-react';
import type { Player } from '@/types';
import { cn } from '@/lib/utils';


interface TeamFormationLobbyProps {
  player: Player | null;
  onLeave: () => void;
}

const mockTeam = [
    { slot: 1, player: null },
    { slot: 2, player: null },
    { slot: 3, player: null },
    { slot: 4, player: null },
];

function TeamSlot({ slot, player, onJoin, teamName, disabled }: { slot: number; player: Player | null; onJoin: (team: 'blue' | 'red') => void; teamName: 'blue' | 'red'; disabled?: boolean }) {
    const canJoin = !player && !disabled;
    return (
        <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-muted">
                    {player ? (
                        <>
                         <AvatarImage src={player.avatarUrl} alt={player.username} data-ai-hint="avatar placeholder" />
                         <AvatarFallback>{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </>
                    ) : (
                        <AvatarFallback>?</AvatarFallback>
                    )}
                </Avatar>
                <div className="flex flex-col">
                   <span className="font-semibold text-sm text-foreground">{player?.username || `Slot ${slot}`}</span>
                   {player && <span className="text-xs text-muted-foreground">Rating: {player.rating}</span>}
                </div>
            </div>
            {canJoin ? (
                 <Button size="sm" variant="secondary" onClick={() => onJoin(teamName)}>Join</Button>
            ) : player ? (
                <span className="text-xs font-medium text-green-500">Ready</span>
            ) : null}
        </div>
    );
}


function TeamCard({ teamName, team, onJoin, disabled }: { teamName: 'Blue' | 'Red'; team: any[]; onJoin: (team: 'blue' | 'red') => void; disabled?: boolean; }) {
    const teamColor = teamName === 'Blue' ? 'blue' : 'red';
    
    return (
        <Card className={cn("flex flex-col", `border-${teamColor}-500`)}>
            <CardHeader className={cn("text-center text-white rounded-t-lg", `bg-${teamColor}-600`)}>
                <CardTitle className="text-2xl">{teamName} Team</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {team.map(p => <TeamSlot key={p.slot} slot={p.slot} player={p.player} onJoin={onJoin} teamName={teamName.toLowerCase() as 'blue' | 'red'} disabled={disabled} />)}
            </CardContent>
        </Card>
    );
}


export function TeamFormationLobby({ player, onLeave }: TeamFormationLobbyProps) {
    if (!player) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <p className="mb-4">Loading player data...</p><Loader2 className="h-8 w-8 animate-spin"/>
            </div>
        );
    }
    
    const isPlayerInLobby = false; // Mock data for now

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
                        <TeamCard teamName="Blue" team={mockTeam} onJoin={() => {}} disabled={isPlayerInLobby}/>
                        <TeamCard teamName="Red" team={mockTeam} onJoin={() => {}} disabled={isPlayerInLobby}/>
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                    <p className="text-sm text-muted-foreground">Waiting for more players... (0/8)</p>
                    <Button variant="outline" onClick={onLeave}>
                        <LogOut className="mr-2 h-4 w-4" /> Leave Lobby
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
