"use client";

import type { Player } from '@/types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  player: Player | null;
  setPlayer: Dispatch<SetStateAction<Player | null>>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching user data
    setTimeout(() => {
      setPlayer({
        id: 'player123',
        username: 'CodeWarrior',
        coins: 1000,
        rank: 15,
        rating: 1250,
        avatarUrl: 'https://placehold.co/100x100.png',
      });
      setIsLoading(false);
    }, 500);
  }, []);

  return (
    <AuthContext.Provider value={{ player, setPlayer, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
