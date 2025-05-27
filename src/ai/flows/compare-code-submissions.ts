
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
import type { EvaluateCodeSubmissionInput, EvaluateCodeSubmissionOutput } from './evaluate-code-submission'; // Assuming this is in the same directory or path is correct
import { evaluateCodeSubmission } from './evaluate-code-submission';


const CompareCodeSubmissionsInputSchema = z.object({
  player1Code: z.string().describe("The code submitted by Player 1 (human player)."),
  player2Code: z.string().describe("The code submitted by Player 2 (mock opponent, likely the reference solution)."),
  referenceSolution: z.string().describe("The official reference solution for the coding problem (likely JavaScript)."),
  problemStatement: z.string().describe("The full problem statement of the coding challenge."),
  language: z.string().describe("The programming language of Player 1's submission (e.g., 'javascript', 'python', 'cpp'). Player 2's code is assumed to be JavaScript (the reference)."),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe("The difficulty of the problem."),
});
export type CompareCodeSubmissionsInput = z.infer<typeof CompareCodeSubmissionsInputSchema>;

const CompareCodeSubmissionsOutputSchema = z.object({
  player1Evaluation: z.custom<EvaluateCodeSubmissionOutput>().describe("Detailed evaluation of Player 1's code."),
  player2Evaluation: z.custom<EvaluateCodeSubmissionOutput>().describe("Detailed evaluation of Player 2's code (based on the reference solution)."),
  winner: z.enum(['player1', 'player2', 'draw']).describe("The determined winner of the duel, or 'draw'."),
  winningReason: z.string().describe("A concise explanation for why the winner was chosen or why it's a draw."),
  comparisonSummary: z.string().describe("A brief summary comparing the two solutions, highlighting key differences or strengths."),
});
export type CompareCodeSubmissionsOutput = z.infer<typeof CompareCodeSubmissionsOutputSchema>;


export async function compareCodeSubmissions(input: CompareCodeSubmissionsInput): Promise<CompareCodeSubmissionsOutput> {
  // We will call evaluateCodeSubmission for both, then use another prompt for comparison
  // OR enhance the main prompt to do both. For simplicity and re-use, let's call evaluateCodeSubmission.

  const player1EvalInput: EvaluateCodeSubmissionInput = {
    playerCode: input.player1Code,
    referenceSolution: input.referenceSolution, // P1 is compared against the ideal solution
    problemStatement: input.problemStatement,
    language: input.language, // P1's chosen language
    difficulty: input.difficulty,
  };
  const player1Eval = await evaluateCodeSubmission(player1EvalInput);

  // For player 2 (opponent, using the reference solution), we evaluate it as if it were a submission in JavaScript.
  const player2EvalInput: EvaluateCodeSubmissionInput = {
    playerCode: input.player2Code, // This is the reference solution itself
    referenceSolution: input.referenceSolution, // Comparing ref solution against itself
    problemStatement: input.problemStatement,
    language: 'javascript', // Opponent/reference is assumed to be JS for this evaluation
    difficulty: input.difficulty,
  };
  const player2Eval = await evaluateCodeSubmission(player2EvalInput);
  
  // Now, use another prompt to determine the winner based on these evaluations
  const comparisonPromptInput = {
    player1Evaluation: player1Eval,
    player2Evaluation: player2Eval,
    problemStatement: input.problemStatement,
    player1Language: input.language,
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

// Schema for the input to the winner determination prompt
const WinnerDeterminationPromptInputSchema = z.object({
    player1Evaluation: z.custom<EvaluateCodeSubmissionOutput>(),
    player2Evaluation: z.custom<EvaluateCodeSubmissionOutput>(),
    problemStatement: z.string(),
    player1Language: z.string(),
});

// Schema for the output of the winner determination part (subset of CompareCodeSubmissionsOutput)
const WinnerDeterminationOutputSchema = z.object({
  winner: z.enum(['player1', 'player2', 'draw']),
  winningReason: z.string(),
  comparisonSummary: z.string(),
});


const winnerDeterminationPrompt = ai.definePrompt({
    name: 'winnerDeterminationPrompt',
    input: { schema: WinnerDeterminationPromptInputSchema },
    output: { schema: WinnerDeterminationOutputSchema },
    prompt: `You are the final judge in a coding duel. You have received evaluations for two players. Player 1 used {{player1Language}}. Player 2's solution is the reference JavaScript solution.

Problem Statement:
{{{problemStatement}}}

Player 1 Evaluation:
Correct: {{player1Evaluation.isPotentiallyCorrect}}
Correctness Explanation: {{player1Evaluation.correctnessExplanation}}
Time Complexity: {{player1Evaluation.estimatedTimeComplexity}}
Space Complexity: {{player1Evaluation.estimatedSpaceComplexity}}
Code Quality Feedback: {{player1Evaluation.codeQualityFeedback}}
Overall Assessment: {{player1Evaluation.overallAssessment}}

Player 2 (Reference Solution) Evaluation:
Correct: {{player2Evaluation.isPotentiallyCorrect}}
Correctness Explanation: {{player2Evaluation.correctnessExplanation}}
Time Complexity: {{player2Evaluation.estimatedTimeComplexity}}
Space Complexity: {{player2Evaluation.estimatedSpaceComplexity}}
Code Quality Feedback: {{player2Evaluation.codeQualityFeedback}}
Overall Assessment: {{player2Evaluation.overallAssessment}}

Based on these evaluations, determine the winner ('player1', 'player2', or 'draw'). Provide a 'winningReason' and a 'comparisonSummary'.

Decision Logic:
1.  **Correctness is paramount.**
    *   If Player 1 is correct and Player 2 is not (unlikely for reference, but possible if eval is imperfect), Player 1 wins.
    *   If Player 2 is correct and Player 1 is not, Player 2 wins.
2.  **If both are correct:**
    *   Compare complexities. A significantly better complexity (e.g., O(n) vs O(n^2)) is a strong factor.
    *   Consider code quality. Cleaner, more idiomatic code (for Player 1's language) is preferred.
    *   If complexities and quality are very similar, it can be a 'draw' or lean towards the player who demonstrated better problem-solving if nuances exist. Player 2 (reference) should be a high bar.
3.  **If both are incorrect:**
    *   It's a 'draw'. Or, if one solution is substantially closer to being correct or demonstrates better partial logic, they might be considered. For a duel, typically a draw if both fail.
4.  **Time's Up / Non-Submissions (Handled by game logic, but for context):** If a player didn't submit or ran out of time, they typically lose unless the other also failed to submit.

Provide your output in the specified JSON format. Focus on a fair comparison. Player 1 might have a valid solution even if it differs significantly from Player 2's (the reference).
`,
});

// The main flow is implicitly defined by the exported compareCodeSubmissions function
// No explicit ai.defineFlow is needed here as the logic is more complex than a single prompt.
// However, if we wanted to encapsulate the whole thing:
/*
const compareCodeSubmissionsFlow = ai.defineFlow(
  {
    name: 'compareCodeSubmissionsFlow',
    inputSchema: CompareCodeSubmissionsInputSchema,
    outputSchema: CompareCodeSubmissionsOutputSchema,
  },
  async (input) => {
    // ... (logic from the exported function would go here) ...
    // This decomposition into a primary function calling other prompts/logic is fine.
    const player1EvalInput: EvaluateCodeSubmissionInput = {
        playerCode: input.player1Code,
        referenceSolution: input.referenceSolution,
        problemStatement: input.problemStatement,
        language: input.language,
        difficulty: input.difficulty,
    };
    const player1Eval = await evaluateCodeSubmission(player1EvalInput);

    const player2EvalInput: EvaluateCodeSubmissionInput = {
        playerCode: input.player2Code,
        referenceSolution: input.referenceSolution,
        problemStatement: input.problemStatement,
        language: 'javascript', // Assuming opponent/reference is JS
        difficulty: input.difficulty,
    };
    const player2Eval = await evaluateCodeSubmission(player2EvalInput);
    
    const comparisonPromptInput = {
        player1Evaluation: player1Eval,
        player2Evaluation: player2Eval,
        problemStatement: input.problemStatement,
        player1Language: input.language,
    };

    const { output: winnerOutput } = await winnerDeterminationPrompt(comparisonPromptInput);
    if (!winnerOutput) {
        throw new Error("AI failed to determine a winner.");
    }

    return {
        player1Evaluation: player1Eval,
        player2Evaluation: player2Eval,
        winner: winnerOutput.winner,
        winningReason: winnerOutput.winningReason,
        comparisonSummary: winnerOutput.comparisonSummary,
    };
  }
);
*/
// For now, the exported async function `compareCodeSubmissions` acts as the flow executor.
