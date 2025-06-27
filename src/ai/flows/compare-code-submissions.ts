
'use server';
/**
 * @fileOverview A Genkit flow for comparing two code submissions (player vs. opponent) for a coding duel.
 *
 * - compareCodeSubmissions - Analyzes both submissions, determines a winner, and provides detailed feedback.
 * - CompareCodeSubmissionsInput - Input type for the comparison.
 * - CompareCodeSubmissionsOutput - Output type for the comparison.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { EvaluateCodeSubmissionInput, EvaluateCodeSubmissionOutput } from './evaluate-code-submission';
import { evaluateCodeSubmission } from './evaluate-code-submission';


const CompareCodeSubmissionsInputSchema = z.object({
  player1Code: z.string().describe("The code submitted by Player 1."),
  player2Code: z.string().describe("The code submitted by Player 2."),
  player1Language: z.string().describe("The programming language of Player 1's submission."),
  player2Language: z.string().describe("The programming language of Player 2's submission."),
  referenceSolution: z.string().describe("The official reference solution for the coding problem (JavaScript)."),
  problemStatement: z.string().describe("The full problem statement of the coding challenge."),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe("The difficulty of the problem."),
});
export type CompareCodeSubmissionsInput = z.infer<typeof CompareCodeSubmissionsInputSchema>;

const CompareCodeSubmissionsOutputSchema = z.object({
  player1Evaluation: z.custom<EvaluateCodeSubmissionOutput>().describe("Detailed evaluation of Player 1's code."),
  player2Evaluation: z.custom<EvaluateCodeSubmissionOutput>().describe("Detailed evaluation of Player 2's code."),
  winner: z.enum(['player1', 'player2', 'draw']).describe("The determined winner of the duel, or 'draw'."),
  winningReason: z.string().describe("A concise explanation for why the winner was chosen or why it's a draw."),
  comparisonSummary: z.string().describe("A brief summary comparing the two solutions, highlighting key differences or strengths."),
});
export type CompareCodeSubmissionsOutput = z.infer<typeof CompareCodeSubmissionsOutputSchema>;


export async function compareCodeSubmissions(input: CompareCodeSubmissionsInput): Promise<CompareCodeSubmissionsOutput> {
  const player1EvalInput: EvaluateCodeSubmissionInput = {
    playerCode: input.player1Code,
    referenceSolution: input.referenceSolution,
    problemStatement: input.problemStatement,
    language: input.player1Language,
    difficulty: input.difficulty,
  };

  const player2EvalInput: EvaluateCodeSubmissionInput = {
    playerCode: input.player2Code,
    referenceSolution: input.referenceSolution,
    problemStatement: input.problemStatement,
    language: input.player2Language,
    difficulty: input.difficulty,
  };

  const [player1Eval, player2Eval] = await Promise.all([
    evaluateCodeSubmission(player1EvalInput),
    evaluateCodeSubmission(player2EvalInput)
  ]);
  
  const comparisonPromptInput = {
    player1Evaluation: player1Eval,
    player2Evaluation: player2Eval,
    problemStatement: input.problemStatement,
    player1Language: input.player1Language,
    player2Language: input.player2Language,
  };

  const { output } = await winnerDeterminationPrompt(comparisonPromptInput);
  if (!output) {
    throw new Error("AI failed to determine a winner or provide comparison.");
  }

  return {
    player1Evaluation: player1Eval,
    player2Evaluation: player2Eval,
    winner: output.winner,
    winningReason: output.winningReason,
    comparisonSummary: output.comparisonSummary,
  };
}

const WinnerDeterminationPromptInputSchema = z.object({
    player1Evaluation: z.custom<EvaluateCodeSubmissionOutput>(),
    player2Evaluation: z.custom<EvaluateCodeSubmissionOutput>(),
    problemStatement: z.string(),
    player1Language: z.string(),
    player2Language: z.string(),
});

const WinnerDeterminationOutputSchema = z.object({
  winner: z.enum(['player1', 'player2', 'draw']),
  winningReason: z.string(),
  comparisonSummary: z.string(),
});


const winnerDeterminationPrompt = ai.definePrompt({
    name: 'winnerDeterminationPrompt',
    input: { schema: WinnerDeterminationPromptInputSchema },
    output: { schema: WinnerDeterminationOutputSchema },
    prompt: `You are the final judge in a coding duel. You have received evaluations for two players. Player 1 used {{player1Language}} and Player 2 used {{player2Language}}.

Problem Statement:
{{{problemStatement}}}

Player 1 Evaluation (Language: {{player1Language}}):
Correct: {{player1Evaluation.isPotentiallyCorrect}}
Correctness Explanation: {{player1Evaluation.correctnessExplanation}}
Time Complexity: {{player1Evaluation.estimatedTimeComplexity}}
Space Complexity: {{player1Evaluation.estimatedSpaceComplexity}}
Code Quality Feedback: {{player1Evaluation.codeQualityFeedback}}
Overall Assessment: {{player1Evaluation.overallAssessment}}

Player 2 Evaluation (Language: {{player2Language}}):
Correct: {{player2Evaluation.isPotentiallyCorrect}}
Correctness Explanation: {{player2Evaluation.correctnessExplanation}}
Time Complexity: {{player2Evaluation.estimatedTimeComplexity}}
Space Complexity: {{player2Evaluation.estimatedSpaceComplexity}}
Code Quality Feedback: {{player2Evaluation.codeQualityFeedback}}
Overall Assessment: {{player2Evaluation.overallAssessment}}

Based on these evaluations, determine the winner ('player1', 'player2', or 'draw'). Provide a 'winningReason' and a 'comparisonSummary'.

Decision Logic:
1.  **Correctness is paramount.** If one player's solution is correct and the other's is not, the correct one wins.
2.  **If both are correct:** Compare complexities. A significantly better complexity (e.g., O(n) vs O(n^2)) is a strong winning factor. If complexities are similar, consider code quality. Cleaner, more idiomatic code for their respective language is preferred. If all else is very close, declare a draw.
3.  **If both are incorrect:** It's a 'draw'.

Provide your output in the specified JSON format. Focus on a fair comparison.
`,
});
