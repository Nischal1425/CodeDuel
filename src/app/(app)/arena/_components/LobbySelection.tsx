
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Swords, Coins as CoinsIcon, AlertTriangle, Users, PlusCircle, Gamepad, KeyRound } from 'lucide-react';
import type { Player, GameMode } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export type DifficultyLobby = 'easy' | 'medium' | 'hard';

export interface LobbyInfo {
  name: DifficultyLobby;
  title: string;
  description: string;
  icon: React.ElementType;
  baseTime: number; // minutes
  entryFee: number;
  gameMode: GameMode;
}

interface LobbySelectionProps {
  lobbies: LobbyInfo[];
  player: Player | null;
  onLobbySelect: (lobby: LobbyInfo) => void;
  isFirebaseConfigured: boolean;
  // New props for custom 4v4 lobbies
  onCreateCustomLobby: (lobbyName: DifficultyLobby) => void;
  onJoinCustomLobby: (lobbyCode: string) => void;
  onFindPublicTeamMatch: (lobbyName: DifficultyLobby) => void;
}

function LobbyCard({ lobby, onSelectLobby, disabled }: { lobby: LobbyInfo; onSelectLobby: (lobby: LobbyInfo) => void; disabled?: boolean; }) {
  return (
    <Card className={cn("flex flex-col transition-shadow hover:shadow-lg", disabled ? "opacity-70" : "")}>
      <CardHeader className="items-center text-center">
        <lobby.icon className="h-12 w-12 text-primary mb-3" />
        <CardTitle className="text-2xl">{lobby.title}</CardTitle>
        <CardDescription>{lobby.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-2 text-sm text-muted-foreground flex-grow">
        <p className="font-semibold text-primary">Entry Fee: {lobby.entryFee} <CoinsIcon className="inline h-4 w-4 text-yellow-500" /></p>
      </CardContent>
      <CardFooter>
        <Button
            className="w-full"
            onClick={() => onSelectLobby(lobby)}
            disabled={disabled}
        >
          Join Duel
        </Button>
      </CardFooter>
    </Card>
  );
}

function TeamLobbyCard({ lobby, onCreate, onFind, onJoin, disabled }: { lobby: LobbyInfo; onCreate: () => void; onFind: () => void; onJoin: (code: string) => void; disabled?: boolean; }) {
    const [joinCode, setJoinCode] = useState('');
    
    return (
        <Card className={cn("flex flex-col transition-shadow hover:shadow-lg col-span-1 md:col-span-3", disabled ? "opacity-70" : "")}>
            <CardHeader className="items-center text-center">
                <lobby.icon className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl">{lobby.title}</CardTitle>
                <CardDescription>{lobby.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-2 text-sm text-muted-foreground flex-grow">
                <p className="font-semibold text-primary">Entry Fee: {lobby.entryFee} <CoinsIcon className="inline h-4 w-4 text-yellow-500" /></p>
            </CardContent>
            <CardFooter className="flex-col md:flex-row gap-4 p-4">
                 <div className="w-full flex-1 flex flex-col gap-2">
                    <Button className="w-full" onClick={onFind} disabled={disabled}>
                        <Gamepad className="mr-2"/> Find Public Match
                    </Button>
                    <Button className="w-full" variant="secondary" onClick={onCreate} disabled={disabled}>
                       <PlusCircle className="mr-2"/> Create Custom Game
                    </Button>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Separator orientation="vertical" className="h-10 hidden md:block"/>
                    <Separator orientation="horizontal" className="w-full md:hidden"/>
                </div>
                <div className="w-full flex-1 flex flex-col gap-2 items-center">
                    <div className="flex w-full max-w-sm items-center space-x-2">
                        <Input 
                            type="text" 
                            placeholder="Lobby Code" 
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            className="bg-background"
                            disabled={disabled}
                        />
                        <Button variant="outline" onClick={() => onJoin(joinCode)} disabled={disabled || !joinCode}>
                            <KeyRound className="mr-2"/> Join
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Join a friend's lobby with a code.</p>
                </div>
            </CardFooter>
        </Card>
    );
}

export function LobbySelection({ lobbies, player, onLobbySelect, isFirebaseConfigured, onCreateCustomLobby, onJoinCustomLobby, onFindPublicTeamMatch }: LobbySelectionProps) {
    const duelLobbies = lobbies.filter(l => l.gameMode === '1v1');
    const teamLobby = lobbies.find(l => l.gameMode === '4v4');

    const notEnoughCoins = (fee: number) => !player || player.coins < fee;

    return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center">
            <Card className="mb-8 shadow-lg">
                <CardHeader className="text-center">
                <Swords className="h-16 w-16 mx-auto text-primary mb-4"/>
                <CardTitle className="text-3xl font-bold">Choose Your Arena</CardTitle>
                <CardDescription className="text-lg">Select a lobby. Entry fees apply. Current Coins: {player?.coins ?? 0} <CoinsIcon className="inline h-5 w-5 text-yellow-500 align-text-bottom" /></CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold text-center mb-4 border-b pb-2">1v1 Duel Lobbies</h3>
                        <div className="grid md:grid-cols-3 gap-6">
                            {duelLobbies.map(lobby => (
                                <LobbyCard 
                                    key={lobby.name} 
                                    lobby={lobby} 
                                    onSelectLobby={onLobbySelect} 
                                    disabled={notEnoughCoins(lobby.entryFee)}
                                />
                            ))}
                        </div>
                    </div>
                     {teamLobby && (
                         <div>
                            <h3 className="text-xl font-semibold text-center mb-4 border-b pb-2">4v4 Team DeathMatch</h3>
                            <div className="grid md:grid-cols-3 gap-6">
                               <TeamLobbyCard
                                 key={teamLobby.name}
                                 lobby={teamLobby}
                                 onCreate={() => onCreateCustomLobby(teamLobby.name)}
                                 onFind={() => onFindPublicTeamMatch(teamLobby.name)}
                                 onJoin={onJoinCustomLobby}
                                 disabled={notEnoughCoins(teamLobby.entryFee)}
                               />
                            </div>
                        </div>
                     )}
                </CardContent>
            </Card>
            {!isFirebaseConfigured && (
                <Alert variant="destructive" className="max-w-md mx-auto mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Developer Notice: Live PvP Disabled</AlertTitle>
                    <AlertDescription>
                    No Firebase credentials found. The app is running in offline bot mode. You will play against a bot.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
