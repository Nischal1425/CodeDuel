"use client";

import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, BarChart3 } from 'lucide-react';

export function UserDisplay() {
  const { player, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 border-b border-sidebar-border">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (!player) {
    return null; 
  }

  return (
    <div className="flex flex-col items-center gap-2 p-4 border-b border-sidebar-border text-center">
      <Avatar className="h-20 w-20 border-2 border-primary shadow-md">
        <AvatarImage src={player.avatarUrl} alt={player.username} data-ai-hint="placeholder avatar" />
        <AvatarFallback>{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <h2 className="text-xl font-semibold text-sidebar-foreground mt-2">{player.username}</h2>
      <div className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
        <Coins className="h-4 w-4 text-yellow-500" />
        <span>{player.coins.toLocaleString()} Coins</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span>Rank: {player.rank} (Rating: {player.rating})</span>
      </div>
    </div>
  );
}
