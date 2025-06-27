
import type { Achievement, Player } from '@/types';
import { ALL_ACHIEVEMENTS } from './achievements';

interface MatchResult {
  won: boolean;
  opponentRank: number;
  lobbyDifficulty: 'easy' | 'medium' | 'hard';
}

interface AchievementCheckResult {
  updatedPlayer: Player;
  newlyUnlocked: Achievement[];
}

/**
 * Processes a player's stats after a match and checks for newly unlocked achievements.
 * This function is pure and returns a new player object and a list of new achievements.
 * It does NOT mutate the original player object.
 */
export function checkAchievementsOnMatchEnd(
  player: Player,
  matchResult: MatchResult
): AchievementCheckResult {

  // 1. Create a mutable copy of the player's stats to update
  const updatedStats = {
    ...player,
    unlockedAchievements: [...player.unlockedAchievements], // Ensure achievements array is also a copy
  };

  // 2. Update core stats based on match outcome
  updatedStats.matchesPlayed += 1;
  if (matchResult.won) {
    updatedStats.wins += 1;
    updatedStats.winStreak += 1;
  } else {
    updatedStats.losses += 1;
    updatedStats.winStreak = 0; // Reset streak on loss
  }
  
  const newlyUnlocked: Achievement[] = [];

  // 3. Iterate through all possible achievements to check for unlocks
  for (const achievement of ALL_ACHIEVEMENTS) {
    // Skip if player already has this achievement
    if (updatedStats.unlockedAchievements.includes(achievement.id)) {
      continue;
    }

    let isUnlocked = false;

    // Check achievement conditions
    if (achievement.type === 'counter' && achievement.stat) {
      // Handle counter-based achievements (e.g., reach 100 wins)
      const playerStatValue = updatedStats[achievement.stat] as number;
      if (playerStatValue >= achievement.goal) {
        isUnlocked = true;
      }
    } else if (achievement.type === 'boolean' && achievement.stat) {
        // Handle boolean achievements based on a stat (e.g. first win)
        const playerStatValue = updatedStats[achievement.stat] as number;
        if (playerStatValue >= achievement.goal) {
            isUnlocked = true;
        }
    } else {
      // Handle special, event-based achievements not tied to a single stat
      switch (achievement.id) {
        case 'high_roller':
          if (matchResult.won && matchResult.lobbyDifficulty === 'hard') {
            isUnlocked = true;
          }
          break;
        case 'top_10':
          // We check the player's rank *before* the match for this one
          if (player.rank <= 10) {
            isUnlocked = true;
          }
          break;
        case 'giant_slayer':
          if (matchResult.won && matchResult.opponentRank >= player.rank + 5) {
            isUnlocked = true;
          }
          break;
      }
    }

    // 4. If an achievement was unlocked, update player stats and add to lists
    if (isUnlocked) {
      updatedStats.unlockedAchievements.push(achievement.id);
      newlyUnlocked.push(achievement);
      
      // Apply any rewards
      if (achievement.reward?.type === 'coins') {
        updatedStats.coins += achievement.reward.amount;
      }
    }
  }

  return {
    updatedPlayer: updatedStats,
    newlyUnlocked: newlyUnlocked,
  };
}
