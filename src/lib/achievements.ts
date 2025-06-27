import type { Achievement } from '@/types';
import { Award, BarChart3, Gem, Shield, Star, Sword, Zap } from 'lucide-react';

export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Win your first duel.',
    icon: Sword,
  },
  {
    id: 'hot_streak_3',
    name: 'Hot Streak',
    description: 'Win 3 duels in a row.',
    icon: Zap,
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Play 100 matches.',
    icon: Shield,
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Win a duel in the "Hard" lobby.',
    icon: Gem,
  },
  {
    id: 'top_10',
    name: 'Top 10 Finisher',
    description: 'Finish a match while ranked in the top 10.',
    icon: Award,
  },
  {
    id: 'rank_25',
    name: 'Elite Duelist',
    description: 'Reach player rank 25.',
    icon: Star,
  },
  {
    id: 'rating_1500',
    name: 'Veteran',
    description: 'Achieve a rating of 1500 or higher.',
    icon: BarChart3,
  },
];
