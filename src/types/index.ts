export interface Player {
  id: string;
  username: string;
  email?: string;
  coins: number;
  rank: number;
  rating: number;
  avatarUrl?: string;
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
  username: string;
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
