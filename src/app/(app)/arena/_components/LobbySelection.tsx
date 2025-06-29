"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Swords, Coins as CoinsIcon, AlertTriangle } from 'lucide-react';
import type { Player } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type DifficultyLobby = 'easy' | 'medium' | 'hard';

export interface LobbyInfo {
  name: DifficultyLobby;
  title: string;
  description: string;
  icon: React.ElementType;
  baseTime: number; // minutes
  entryFee: number;
}

interface LobbySelectionProps {
  lobbies: LobbyInfo[];
  player: Player | null;
  onSelectLobby: (difficulty: DifficultyLobby) => void;
  isFirebaseConfigured: boolean;
}

function LobbyCard({ lobby, onSelectLobby, disabled }: { lobby: LobbyInfo; onSelectLobby: (difficulty: DifficultyLobby) => void; disabled?: boolean; }) {
  return (
    <Card className={`hover:shadow-lg transition-shadow ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} flex flex-col`}>
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
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => !disabled && onSelectLobby(lobby.name)}
            disabled={disabled}
        >
          Join {lobby.name.charAt(0).toUpperCase() + lobby.name.slice(1)} Lobby
        </Button>
      </CardFooter>
    </Card>
  );
}

export function LobbySelection({ lobbies, player, onSelectLobby, isFirebaseConfigured }: LobbySelectionProps) {
    return (
        <div className="container mx-auto py-8 h-full flex flex-col justify-center">
            <Card className="mb-8 shadow-lg">
                <CardHeader className="text-center">
                <Swords className="h-16 w-16 mx-auto text-primary mb-4"/>
                <CardTitle className="text-3xl font-bold">Choose Your Arena</CardTitle>
                <CardDescription className="text-lg">Select a lobby. Entry fees apply. Current Coins: {player?.coins ?? 0} <CoinsIcon className="inline h-5 w-5 text-yellow-500 align-text-bottom" /></CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-6">
                {lobbies.map(lobby => (
                    <LobbyCard 
                        key={lobby.name} 
                        lobby={lobby} 
                        onSelectLobby={onSelectLobby} 
                        disabled={!player || player.coins < lobby.entryFee}
                    />
                ))}
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
