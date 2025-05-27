'use server';
/**
 * @fileOverview A Genkit flow for evaluating a player's code submission in a coding duel.
 *
 * - evaluateCodeSubmission - Analyzes code for correctness, complexity, and quality.
 * - EvaluateCodeSubmissionInput - Input type for the evaluation.
 * - EvaluateCodeSubmissionOutput - Output type for the evaluation.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluateCodeSubmissionInputSchema = z.object({
  playerCode: z.string().describe("The code submitted by the player."),
  referenceSolution: z.string().describe("The official reference solution for the coding problem."),
  problemStatement: z.string().describe("The full problem statement of the coding challenge."),
  language: z.string().describe("The programming language of the submission (e.g., 'javascript', 'python')."),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe("The difficulty of the problem."),
});
export type EvaluateCodeSubmissionInput = z.infer<typeof EvaluateCodeSubmissionInputSchema>;

const EvaluateCodeSubmissionOutputSchema = z.object({
  isPotentiallyCorrect: z.boolean().describe("AI's assessment of whether the player's code is functionally correct for the given problem. True if likely correct, false otherwise."),
  correctnessExplanation: z.string().describe("A brief explanation for the correctness assessment, highlighting why it's considered correct or pointing out specific flaws if incorrect."),
  similarityToRefSolutionScore: z.number().min(0).max(1).describe("A score (0-1) indicating the structural and logical similarity of the player's code to the reference solution. Higher means more similar. This is not just about character-by-character match but algorithmic approach."),
  similarityToRefSolutionExplanation: z.string().describe("Explanation of key similarities or differences found when comparing the player's code to the reference solution."),
  estimatedTimeComplexity: z.string().describe("Estimated time complexity of the player's code (e.g., 'O(n)', 'O(n log n)', 'O(1)'). State 'Unable to determine' if not clear."),
  estimatedSpaceComplexity: z.string().describe("Estimated space complexity of the player's code (e.g., 'O(n)', 'O(1)'). State 'Unable to determine' if not clear."),
  codeQualityFeedback: z.string().describe("Constructive feedback on the player's code regarding style, readability, best practices, and potential areas for improvement. Be concise and actionable."),
  overallAssessment: z.string().describe("A concise overall summary of the submission's strengths and weaknesses."),
});
export type EvaluateCodeSubmissionOutput = z.infer<typeof EvaluateCodeSubmissionOutputSchema>;

export async function evaluateCodeSubmission(input: EvaluateCodeSubmissionInput): Promise<EvaluateCodeSubmissionOutput> {
  return evaluateCodeSubmissionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateCodeSubmissionPrompt',
  input: {schema: EvaluateCodeSubmissionInputSchema},
  output: {schema: EvaluateCodeSubmissionOutputSchema},
  prompt: `You are an expert code evaluator for a programming competition. Your task is to analyze a player's code submission based on a given problem, a reference solution, and the problem's difficulty. The language of the submission is {{language}}.

Problem Statement:
{{{problemStatement}}}

Reference Solution ({{language}}):
\`\`\`{{language}}
{{{referenceSolution}}}
\`\`\`

Player's Code Submission ({{language}}):
\`\`\`{{language}}
{{{playerCode}}}
\`\`\`

Difficulty: {{{difficulty}}}

Please evaluate the player's submission based on the following criteria:

1.  **Correctness (isPotentiallyCorrect & correctnessExplanation):**
    *   Assess if the player's code likely solves the problem statement correctly.
    *   Compare its logic and outputs (conceptually) against the reference solution and problem requirements.
    *   Set \`isPotentiallyCorrect\` to true if it seems correct, false otherwise.
    *   Provide a brief \`correctnessExplanation\`. If incorrect, point out the primary logical flaw or missed edge case.

2.  **Similarity to Reference Solution (similarityToRefSolutionScore & similarityToRefSolutionExplanation):**
    *   Analyze how similar the player's algorithmic approach and structure are to the reference solution. This is not a simple text diff.
    *   Provide a similarity score between 0 (completely different approach) and 1 (very similar approach).
    *   Explain key similarities or if the player used a notably different but valid (or invalid) strategy.

3.  **Complexity Analysis (estimatedTimeComplexity & estimatedSpaceComplexity):**
    *   Estimate the Big O time complexity of the player's code.
    *   Estimate the Big O space complexity of the player's code.
    *   If unable to determine reliably, state "Unable to determine".

4.  **Code Quality (codeQualityFeedback):**
    *   Provide brief, actionable feedback on the player's code regarding clarity, naming conventions, potential bugs, adherence to best practices for {{language}}, and areas for improvement. Avoid overly verbose comments.

5.  **Overall Assessment (overallAssessment):**
    *   Give a concise summary (1-2 sentences) of the submission's performance, highlighting key strengths and areas needing improvement.

Ensure your output is in the specified JSON format. Be fair, consistent, and focus on providing constructive analysis. The player's code might be partially correct or entirely different from the reference but still valid.
`,
});

const evaluateCodeSubmissionFlow = ai.defineFlow(
  {
    name: 'evaluateCodeSubmissionFlow',
    inputSchema: EvaluateCodeSubmissionInputSchema,
    outputSchema: EvaluateCodeSubmissionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
        throw new Error("AI failed to provide an evaluation response.");
    }
    return output;
  }
);
