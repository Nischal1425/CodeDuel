"use client";

import React from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DifficultyLobby } from './LobbySelection';

interface SearchingViewProps {
  selectedLobbyName: DifficultyLobby | null;
  onCancelSearch: () => void;
}

export function SearchingView({ selectedLobbyName, onCancelSearch }: SearchingViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h2 className="text-2xl font-semibold text-foreground mb-2">Waiting for an Opponent...</h2>
      <p className="text-muted-foreground">Searching in the <span className="font-medium text-primary">{selectedLobbyName}</span> lobby.</p>
      <Button variant="outline" onClick={onCancelSearch} className="mt-6">
          <LogOut className="mr-2 h-4 w-4" /> Cancel Search
      </Button>
    </div>
  );
}
