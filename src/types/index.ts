import type { ElementType } from 'react';

export interface Player {
  id: string;
  username: string;
  email?: string;
  coins: number;
  rank: number;
  rating: number;
  avatarUrl?: string;
  unlockedAchievements: string[];
  // New stats for achievements
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  // New field for Pro Circuit
  isKycVerified: boolean;
}

export interface Question {
  id: string;
  problemStatement: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimitMinutes: number; // Time limit in minutes
  // Solution is typically not sent to client during battle
  solution?: string; 
}

export interface Battle {
  battleId: string;
  player1: Player;
  player2?: Player; // Optional if waiting for opponent
  question: Question;
  status: 'waiting' | 'in-progress' | 'player1_submitted' | 'player2_submitted' | 'completed';
  winnerId?: string;
  startTime?: Date;
  endTime?: Date;
  player1Code?: string;
  player2Code?: string;
  wagerAmount: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username:string;
  rating: number;
  coins: number;
  matchesPlayed: number;
  winRate: number; // Percentage
}

export interface Transaction {
  txnId: string;
  playerId: string;
  type: 'win' | 'buy' | 'redeem' | 'wager' | 'commission';
  amount: number; // Can be positive (gain) or negative (loss/cost)
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: ElementType;
  // New fields for logic and progress tracking
  type: 'boolean' | 'counter';
  // The player stat to track for this achievement. 'null' for achievements not tied to a single stat (e.g. win in hard lobby).
  stat: keyof Player | null; 
  goal: number; // The target value for 'counter' type or 1 for 'boolean' types tied to a stat.
  reward?: {
    type: 'coins';
    amount: number;
  };
}

export interface MatchHistoryEntry {
  matchId: string;
  opponent: {
    username: string;
    avatarUrl?: string;
  };
  outcome: 'win' | 'loss' | 'draw';
  difficulty: 'easy' | 'medium' | 'hard';
  wager: number;
  date: string; // Using string for simplicity in mock data
}
