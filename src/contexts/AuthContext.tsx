
"use client";

import type { Player } from '@/types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from "firebase/firestore";

// Determine if Firebase is configured
const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

interface AuthContextType {
  player: Player | null;
  setPlayer: Dispatch<SetStateAction<Player | null>>;
  isLoading: boolean;
  logout: () => void; 
  setPlayerId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On initial load, try to get the player ID from session storage
    const storedPlayerId = sessionStorage.getItem('playerId');
    if (storedPlayerId) {
      setPlayerId(storedPlayerId);
    } else {
      // If no ID, we are done loading and there's no player.
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!playerId) {
      // If there's no player ID, ensure player is null.
      setPlayer(null);
      return;
    }

    if (IS_FIREBASE_CONFIGURED) {
      // --- Online Mode: Use Firestore ---
      const unsub = onSnapshot(doc(db, "players", playerId), (doc) => {
        if (doc.exists()) {
          setPlayer({ id: doc.id, ...doc.data() } as Player);
        } else {
          // Player document was deleted or doesn't exist.
          console.warn(`Player with ID ${playerId} not found in Firestore.`);
          logout();
        }
        setIsLoading(false);
      }, (error) => {
        console.error("Error listening to player document:", error);
        logout();
        setIsLoading(false);
      });

      return () => unsub(); // Cleanup listener
    } else {
      // --- Offline/Mock Mode ---
      const username = 'CodeWarrior'; 
      const mockPlayer: Player = {
        id: playerId,
        username: username,
        email: `${username.toLowerCase()}@example.com`,
        coins: 1000,
        rank: 15,
        rating: 1250,
        avatarUrl: `https://placehold.co/100x100.png?text=${username.substring(0,1).toUpperCase()}`,
        unlockedAchievements: ['first_win'],
        matchesPlayed: 25,
        wins: 15,
        losses: 10,
        winStreak: 3,
        isKycVerified: false,
      };
      setPlayer(mockPlayer);
      setIsLoading(false);
    }
  }, [playerId]);

  const handleSetPlayerId = (id: string | null) => {
    setIsLoading(true); // Start loading when ID changes
    if (id) {
        sessionStorage.setItem('playerId', id);
        setPlayerId(id);
    } else {
        sessionStorage.removeItem('playerId');
        setPlayerId(null);
        setIsLoading(false); // No ID, so stop loading
    }
  };

  const logout = () => {
    handleSetPlayerId(null);
  };

  return (
    <AuthContext.Provider value={{ player, setPlayer, isLoading, logout, setPlayerId: handleSetPlayerId }}>
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
