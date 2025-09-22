
'use server';
/**
 * @fileOverview A Genkit flow for comparing all submissions in a 4v4 team battle.
 *
 * - compareTeamSubmissions - Analyzes all 8 submissions, calculates team scores, and determines a winner.
 * - CompareTeamSubmissionsInput - Input type for the comparison.
 * - CompareTeamSubmissionsOutput - Output type for the comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { EvaluateCodeSubmissionInput, EvaluateCodeSubmissionOutput } from './evaluate-code-submission';
import { evaluateCodeSubmission } from './evaluate-code-submission';
import type { TeamBattlePlayer, GenerateCodingChallengeOutput } from '@/types';

// Constants for scoring
const CORRECT_SOLUTION_POINTS = 100;
const SIMILARITY_BONUS_THRESHOLD = 0.8;
const SIMILARITY_BONUS_POINTS = 25;
const COMPLEXITY_BONUS_POINTS = 50;


const CompareTeamSubmissionsInputSchema = z.object({
  team1: z.array(z.custom<TeamBattlePlayer>()).describe("Array of players in Team 1."),
  team2: z.array(z.custom<TeamBattlePlayer>()).describe("Array of players in Team 2."),
  question: z.custom<GenerateCodingChallengeOutput>().describe("The coding challenge details."),
});
export type CompareTeamSubmissionsInput = z.infer<typeof CompareTeamSubmissionsInputSchema>;

const CompareTeamSubmissionsOutputSchema = z.object({
  team1: z.array(z.custom<TeamBattlePlayer>()).describe("Team 1 players with their evaluations filled in."),
  team2: z.array(z.custom<TeamBattlePlayer>()).describe("Team 2 players with their evaluations filled in."),
  team1Score: z.number().describe("Final calculated score for Team 1."),
  team2Score: z.number().describe("Final calculated score for Team 2."),
  winnerTeam: z.enum(['team1', 'team2', 'draw']).describe("The determined winning team."),
});
export type CompareTeamSubmissionsOutput = z.infer<typeof CompareTeamSubmissionsOutputSchema>;


async function evaluatePlayer(player: TeamBattlePlayer, question: GenerateCodingChallengeOutput): Promise<EvaluateCodeSubmissionOutput | null> {
    if (!player.hasSubmitted || !player.code) {
        return null;
    }
    const evalInput: EvaluateCodeSubmissionInput = {
        playerCode: player.code,
        referenceSolution: question.solution,
        problemStatement: question.problemStatement,
        language: player.language,
        difficulty: question.difficulty,
    };
    return await evaluateCodeSubmission(evalInput);
}

function calculatePlayerScore(evaluation: EvaluateCodeSubmissionOutput | null): number {
    if (!evaluation || !evaluation.isPotentiallyCorrect) {
        return 0;
    }
    
    let score = CORRECT_SOLUTION_POINTS;

    // Bonus for high similarity to the reference (good algorithmic choice)
    if (evaluation.similarityToRefSolutionScore >= SIMILARITY_BONUS_THRESHOLD) {
        score += SIMILARITY_BONUS_POINTS;
    }

    // Bonus for optimal time complexity (O(1), O(log n), O(n))
    const optimalComplexities = ['O(1)', 'O(log n)', 'O(n)'];
    if (optimalComplexities.includes(evaluation.estimatedTimeComplexity.toLowerCase().replace(/\s/g, ''))) {
        score += COMPLEXITY_BONUS_POINTS;
    }

    return score;
}


export async function compareTeamSubmissions(input: CompareTeamSubmissionsInput): Promise<CompareTeamSubmissionsOutput> {
  
  const allPlayers = [...input.team1, ...input.team2];
  
  // Evaluate all submissions in parallel
  const evaluations = await Promise.all(
      allPlayers.map(player => evaluatePlayer(player, input.question))
  );

  let team1Score = 0;
  let team2Score = 0;
  
  const updatedTeam1: TeamBattlePlayer[] = [];
  const updatedTeam2: TeamBattlePlayer[] = [];

  for (let i = 0; i < allPlayers.length; i++) {
    const player = allPlayers[i];
    const evaluation = evaluations[i];
    const score = calculatePlayerScore(evaluation);

    const updatedPlayer: TeamBattlePlayer = {
      ...player,
      evaluation: evaluation,
    };

    if (i < input.team1.length) {
      team1Score += score;
      updatedTeam1.push(updatedPlayer);
    } else {
      team2Score += score;
      updatedTeam2.push(updatedPlayer);
    }
  }

  let winnerTeam: 'team1' | 'team2' | 'draw' = 'draw';
  if (team1Score > team2Score) {
    winnerTeam = 'team1';
  } else if (team2Score > team1Score) {
    winnerTeam = 'team2';
  }

  return {
    team1: updatedTeam1,
    team2: updatedTeam2,
    team1Score,
    team2Score,
    winnerTeam,
  };
}
