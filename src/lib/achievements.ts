import type { Achievement } from '@/types';
import { Award, BarChart3, Gem, Shield, Star, Sword, Zap, BrainCircuit } from 'lucide-react';

// Note: For 'boolean' type achievements tied to a stat, 'goal' is implicitly 1.
// We set it explicitly for clarity in our new data structure.
export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    name: 'First Blood',
    description: 'Win your first duel.',
    icon: Sword,
    type: 'counter',
    stat: 'wins',
    goal: 1,
    reward: { type: 'coins', amount: 50 },
  },
  {
    id: 'hot_streak_3',
    name: 'Hot Streak',
    description: 'Win 3 duels in a row.',
    icon: Zap,
    type: 'counter',
    stat: 'winStreak',
    goal: 3,
    reward: { type: 'coins', amount: 100 },
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Play 100 matches.',
    icon: Shield,
    type: 'counter',
    stat: 'matchesPlayed',
    goal: 100,
    reward: { type: 'coins', amount: 500 },
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Win a duel in the "Hard" lobby.',
    icon: Gem,
    type: 'boolean', // This is a specific event, not a counter
    stat: null, 
    goal: 1,
  },
  {
    id: 'top_10',
    name: 'Top 10 Finisher',
    description: 'Finish a match while your player rank is 10 or less.',
    icon: Award,
    type: 'boolean',
    stat: null,
    goal: 1,
  },
  {
    id: 'rank_25',
    name: 'Elite Duelist',
    description: 'Reach player rank 25.',
    icon: Star,
    type: 'counter',
    stat: 'rank',
    goal: 25,
  },
  {
    id: 'rating_1500',
    name: 'Veteran',
    description: 'Achieve a rating of 1500 or higher.',
    icon: BarChart3,
    type: 'counter',
    stat: 'rating',
    goal: 1500,
  },
  {
    id: 'giant_slayer',
    name: 'Giant Slayer',
    description: 'Defeat an opponent with a rank at least 5 levels higher than you.',
    icon: BrainCircuit,
    type: 'boolean',
    stat: null,
    goal: 1,
    reward: { type: 'coins', amount: 150 },
  }
];
