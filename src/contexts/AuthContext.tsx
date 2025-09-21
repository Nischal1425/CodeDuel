
"use client";

import type { Player } from '@/types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, type User } from 'firebase/auth';

// Determine if Firebase is configured
const IS_FIREBASE_CONFIGURED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    if (!IS_FIREBASE_CONFIGURED) {
      setIsLoading(false);
      return;
    }
    // This listener handles Firebase's auth state and is the single source of truth for login status.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsLoading(true);
        if (user) {
            setFirebaseUser(user);
            setPlayerId(user.uid);
            sessionStorage.setItem('playerId', user.uid);
        } else {
            setFirebaseUser(null);
            setPlayerId(null);
            setPlayer(null);
            sessionStorage.removeItem('playerId');
            setIsLoading(false);
        }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setIsLoading(false);
      return;
    }

    if (IS_FIREBASE_CONFIGURED) {
      const unsub = onSnapshot(doc(db, "players", playerId), (doc) => {
        if (doc.exists()) {
          setPlayer({ id: doc.id, ...doc.data() } as Player);
        } else {
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
       if (sessionStorage.getItem('playerId')) {
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
        }
      setIsLoading(false);
    }
  }, [playerId]);

  const handleSetPlayerId = (id: string | null) => {
    // This function is now mainly for the offline mode logic.
    // In online mode, onAuthStateChanged is the source of truth.
    if (!IS_FIREBASE_CONFIGURED) {
        setIsLoading(true);
        if (id) {
            sessionStorage.setItem('playerId', id);
            setPlayerId(id);
        } else {
            sessionStorage.removeItem('playerId');
            setPlayerId(null);
            setIsLoading(false);
        }
    }
  };

  const logout = () => {
    if (IS_FIREBASE_CONFIGURED) {
      auth.signOut();
    } else {
      handleSetPlayerId(null);
    }
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
