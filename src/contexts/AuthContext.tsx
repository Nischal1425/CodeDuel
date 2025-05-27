
"use client";

import type { Player } from '@/types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import for logout redirect if needed later

interface AuthContextType {
  player: Player | null;
  setPlayer: Dispatch<SetStateAction<Player | null>>;
  isLoading: boolean;
  logout: () => void; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true, set to false after check
  // const router = useRouter(); // Uncomment if logout needs to redirect from here

  useEffect(() => {
    // In a real app, you might check localStorage/session here for a persisted user
    // For this mock, we assume the user is not logged in initially.
    // Login will occur on the landing page.
    setIsLoading(false);
  }, []);

  const logout = () => {
    setPlayer(null);
    // router.push('/'); // Optional: redirect to landing page after logout
    // Any other cleanup like clearing local storage tokens would go here
  };

  return (
    <AuthContext.Provider value={{ player, setPlayer, isLoading, logout }}>
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
