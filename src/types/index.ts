

import type { ElementType } from 'react';
import type { GenerateCodingChallengeOutput } from '@/ai/flows/generate-coding-challenge';
import type { CompareCodeSubmissionsOutput } from '@/ai/flows/compare-code-submissions';
import { type EvaluateCodeSubmissionOutput } from '@/ai/flows/evaluate-code-submission';

export type SupportedLanguage = "javascript" | "python" | "cpp";
export type GameMode = "1v1" | "4v4";

export interface Player {
  id: string;
  username: string;
  email?: string;
  coins: number;
  rank: number;
  rating: number;
  avatarUrl?: string;
  unlockedAchievements: string[];
  matchesPlayed: number;
  wins: number;
  losses: number;
  winStreak: number;
  isKycVerified: boolean;
  lastCooldownCompletedAt?: any; // Firestore Timestamp
}

export interface Battle {
  id: string; // Firestore document ID
  player1: { 
    id: string; 
    username: string; 
    avatarUrl?: string; 
    language: SupportedLanguage;
    code?: string;
    hasSubmitted: boolean;
  };
  player2?: { 
    id: string; 
    username: string; 
    avatarUrl?: string; 
    language: SupportedLanguage;
    code?: string;
    hasSubmitted: boolean;
  };
  status: 'waiting' | 'in-progress' | 'comparing' | 'completed' | 'forfeited';
  difficulty: 'easy' | 'medium' | 'hard';
  wager: number;
  question: GenerateCodingChallengeOutput;
  createdAt: any; // Firestore Timestamp
  startedAt?: any; // Firestore Timestamp
  winnerId?: string;
  comparisonResult?: CompareCodeSubmissionsOutput;
}

export interface TeamLobbyPlayer {
    id: string;
    username: string;
    avatarUrl?: string;
    rating: number;
}

export interface TeamBattlePlayer extends TeamLobbyPlayer {
  language: SupportedLanguage;
  code: string;
  hasSubmitted: boolean;
  evaluation?: EvaluateCodeSubmissionOutput | null;
}

export interface TeamLobby {
    blue: { [slot: string]: TeamLobbyPlayer | null };
    red: { [slot: string]: TeamLobbyPlayer | null };
    status: 'waiting' | 'starting';
    battleId?: string; // ADD THIS
}

export interface TeamBattle {
    id: string;
    team1: TeamBattlePlayer[];
    team2: TeamBattlePlayer[];
    team1Score: number;
    team2Score: number;
    status: 'in-progress' | 'comparing' | 'completed';
    difficulty: 'easy' | 'medium' | 'hard';
    wager: number;
    question: GenerateCodingChallengeOutput;
    createdAt: any; // Firestore Timestamp
    winnerTeam: 'team1' | 'team2' | 'draw' | null;
}


export interface Question {
  id:string;
  problemStatement: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimitMinutes: number; // Time limit in minutes
  solution?: string; 
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
  type: 'boolean' | 'counter';
  stat: keyof Player | null; 
  goal: number; 
  reward?: {
    type: 'coins';
    amount: number;
  };
}

export interface MatchHistoryEntry {
  id?: string; // Firestore document ID
  playerId: string;
  matchId: string;
  opponent: {
    username: string;
    avatarUrl?: string;
  };
  outcome: 'win' | 'loss' | 'draw';
  difficulty: 'easy' | 'medium' | 'hard';
  wager: number;
  date: string; 
}


    

    

    
