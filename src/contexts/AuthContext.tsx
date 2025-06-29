
"use client";

import type { Player } from '@/types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from "firebase/firestore";


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
    const storedPlayerId = sessionStorage.getItem('playerId');
    if (storedPlayerId) {
      setPlayerId(storedPlayerId);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (playerId) {
      const unsub = onSnapshot(doc(db, "players", playerId), (doc) => {
        if (doc.exists()) {
          setPlayer({ id: doc.id, ...doc.data() } as Player);
        } else {
          // Player document was deleted or doesn't exist.
          logout();
        }
        setIsLoading(false);
      }, (error) => {
        console.error("Error listening to player document:", error);
        logout();
        setIsLoading(false);
      });

      return () => unsub(); // Cleanup listener on component unmount
    } else {
        setPlayer(null);
    }
  }, [playerId]);

  const handleSetPlayerId = (id: string | null) => {
    if (id) {
        sessionStorage.setItem('playerId', id);
        setPlayerId(id);
    } else {
        sessionStorage.removeItem('playerId');
        setPlayerId(null);
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
