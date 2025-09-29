
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, LogOut, Loader2, Bot, Copy, Check, Lock, Unlock } from 'lucide-react';
import type { Player, TeamLobby, TeamLobbyPlayer } from '@/types';
import { cn } from '@/lib/utils';
import placeholderImages from '@/lib/placeholder-images.json';
import { useToast } from '@/hooks/use-toast';


interface CustomLobbyProps {
  player: Player | null;
  lobbyData: TeamLobby;
  lobbyCode: string;
  onJoinTeam: (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4') => void;
  onLeave: () => void;
  onStartGame: () => void;
  onToggleLock: () => void;
  onFillWithBots: () => void;
}

const SLOTS: ('1' | '2' | '3' | '4')[] = ['1', '2', '3', '4'];


function TeamSlot({ slot, playerInfo, onJoin, teamName, disabled, isHost }: { slot: '1' | '2' | '3' | '4'; playerInfo: TeamLobbyPlayer | null; onJoin: (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4') => void; teamName: 'blue' | 'red'; disabled?: boolean; isHost?: boolean; }) {
    const canJoin = !playerInfo && !disabled;
    
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
            {canJoin ? (
                 <Button size="sm" variant="secondary" onClick={() => onJoin(teamName, slot)}>Join</Button>
            ) : playerInfo ? (
                <span className="text-xs font-medium text-green-500">{isHost && playerInfo.id === isHost ? 'Host' : 'Ready'}</span>
            ) : null}
        </div>
    );
}


function TeamCard({ teamName, teamData, onJoin, disabled, hostId }: { teamName: 'Blue' | 'Red'; teamData: TeamLobby['teams']['blue'] | TeamLobby['teams']['red']; onJoin: (team: 'blue' | 'red', slot: '1' | '2' | '3' | '4') => void; disabled?: boolean; hostId?: string; }) {
    const teamColor = teamName === 'Blue' ? 'blue' : 'red';
    
    return (
        <Card className={cn("flex flex-col", `border-${teamColor}-500`)}>
            <CardHeader className={cn("text-center text-white rounded-t-lg", `bg-${teamColor}-600`)}>
                <CardTitle className="text-2xl">{teamName} Team</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {SLOTS.map(slot => <TeamSlot key={slot} slot={slot} playerInfo={teamData[slot]} onJoin={onJoin} teamName={teamName.toLowerCase() as 'blue' | 'red'} disabled={disabled} isHost={!!hostId && teamData[slot]?.id === hostId} />)}
            </CardContent>
        </Card>
    );
}


export function CustomLobby({ player, lobbyData, lobbyCode, onJoinTeam, onLeave, onStartGame, onToggleLock, onFillWithBots }: CustomLobbyProps) {
    const { toast } = useToast();
    const [copied, setCopied] = React.useState(false);

    if (!player || !lobbyData) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <p className="mb-4">Loading Lobby...</p><Loader2 className="h-8 w-8 animate-spin"/>
            </div>
        );
    }
    
    const allPlayersInLobby = [
        ...Object.values(lobbyData.teams?.blue || {}),
        ...Object.values(lobbyData.teams?.red || {})
    ].filter((p): p is TeamLobbyPlayer => p !== null);

    const isPlayerInLobby = allPlayersInLobby.some(p => p?.id === player.id);
    const totalPlayers = allPlayersInLobby.length;
    const isLobbyFull = totalPlayers === 8;
    const isHost = player.id === lobbyData.hostId;

    const handleCopyCode = () => {
        navigator.clipboard.writeText(lobbyCode).then(() => {
            setCopied(true);
            toast({ title: 'Copied!', description: 'Lobby code copied to clipboard.' });
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center">
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <Users className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-3xl font-bold">Custom 4v4 Lobby</CardTitle>
                    <CardDescription className="text-lg">Assemble your teams for battle!</CardDescription>
                </CardHeader>
                <CardContent className="mt-6 space-y-8">
                     <Card className="bg-muted/50 max-w-sm mx-auto">
                        <CardHeader className="p-4">
                            <CardTitle className="text-base text-center">LOBBY CODE</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex items-center justify-center gap-4">
                            <p className="text-2xl font-mono tracking-widest text-primary">{lobbyCode}</p>
                            <Button variant="ghost" size="icon" onClick={handleCopyCode}>
                                {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <TeamCard teamName="Blue" teamData={lobbyData.teams?.blue || {}} onJoin={onJoinTeam} disabled={isPlayerInLobby} hostId={lobbyData.hostId} />
                        <TeamCard teamName="Red" teamData={lobbyData.teams?.red || {}} onJoin={onJoinTeam} disabled={isPlayerInLobby} hostId={lobbyData.hostId} />
                    </div>
                </CardContent>
                <CardFooter className="flex-col gap-4 pt-6">
                    <p className="text-sm text-muted-foreground">
                        {isLobbyFull ? "Lobby is full! The host can now start the match." : `Waiting for players... (${totalPlayers}/8)`}
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-4">
                        {isHost && (
                            <>
                                <Button onClick={onStartGame} disabled={!isLobbyFull}>Start Game</Button>
                                <Button variant="secondary" onClick={onToggleLock}>
                                    {lobbyData.isPublic ? <Unlock className="mr-2"/> : <Lock className="mr-2" />}
                                    {lobbyData.isPublic ? 'Make Private' : 'Make Public'}
                                </Button>
                                <Button variant="secondary" onClick={onFillWithBots} disabled={isLobbyFull}>
                                    <Bot className="mr-2" /> Fill with Bots
                                </Button>
                            </>
                        )}
                        <Button variant="outline" onClick={onLeave}>
                            <LogOut className="mr-2" /> Leave Lobby
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
