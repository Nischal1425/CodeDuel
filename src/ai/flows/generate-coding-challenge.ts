// src/ai/flows/generate-coding-challenge.ts
'use server';

/**
 * @fileOverview A coding challenge generation AI agent.
 *
 * - generateCodingChallenge - A function that handles the coding challenge generation process.
 * - GenerateCodingChallengeInput - The input type for the generateCodingChallenge function.
 * - GenerateCodingChallengeOutput - The return type for the generateCodingChallenge function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCodingChallengeInputSchema = z.object({
  playerRank: z
    .number()
    .describe('The rank of the player, used to tailor the difficulty of the challenge.'),
  targetDifficulty: z.enum(['easy', 'medium', 'hard']).describe('The target difficulty based on the selected lobby (e.g., easy, medium, hard).'),
});
export type GenerateCodingChallengeInput = z.infer<
  typeof GenerateCodingChallengeInputSchema
>;

const GenerateCodingChallengeOutputSchema = z.object({
  problemStatement: z
    .string()
    .describe('The coding problem statement, including input and output specifications, and clear examples.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the problem, matching the targetDifficulty.'),
  solution: z.string().describe('The reference solution code for the problem in JavaScript. This solution should be correct and efficient for the given problem and difficulty.'),
  // Example: "function solve(params) { /* solution code */ return result; }"
});
export type GenerateCodingChallengeOutput = z.infer<
  typeof GenerateCodingChallengeOutputSchema
>;

export async function generateCodingChallenge(
  input: GenerateCodingChallengeInput
): Promise<GenerateCodingChallengeOutput> {
  return generateCodingChallengeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCodingChallengePrompt',
  input: {schema: GenerateCodingChallengeInputSchema},
  output: {schema: GenerateCodingChallengeOutputSchema},
  prompt: `You are an expert coding challenge generator. You will generate a unique coding problem tailored to the player's skill level and the target difficulty.
The difficulty of the problem must align with the player's rank and the specified target difficulty: a higher rank should correspond to a harder problem within the target difficulty tier.
The coding problem must be very challenging and well suited for a 1v1 coding battle. The solution MUST be in JavaScript.

Player Rank: {{{playerRank}}}
Target Difficulty: {{{targetDifficulty}}}

Generate a coding problem with the following specifications:
- problemStatement: A clear and concise description of the coding problem. Include detailed input and output specifications, constraints, and at least one clear example with input and expected output.
- difficulty: The difficulty level of the problem (must be exactly 'easy', 'medium', or 'hard', matching the targetDifficulty).
- solution: A reference solution code for the problem, written in JavaScript. The solution should be functionally correct and reasonably efficient for the stated difficulty.

Ensure the problem includes obfuscation (logic twist, variable rename, disguised context) to make it AI-resistant but still solvable by a human.
The problem statement should be comprehensive enough for a developer to understand and solve the problem without ambiguity.
The solution should be a complete, runnable JavaScript function if applicable.

Output the problem in a JSON format.
`,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const generateCodingChallengeFlow = ai.defineFlow(
  {
    name: 'generateCodingChallengeFlow',
    inputSchema: GenerateCodingChallengeInputSchema,
    outputSchema: GenerateCodingChallengeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // Ensure difficulty matches target, LLM might sometimes ignore strict enum if not reminded.
    if (output && output.difficulty !== input.targetDifficulty) {
        // Attempt to correct or log this discrepancy. For now, we'll let it pass
        // but in a production system, you might re-prompt or handle this.
        console.warn(`Generated difficulty ${output.difficulty} does not match target ${input.targetDifficulty}`);
        // output.difficulty = input.targetDifficulty; // Force correction if needed
    }
    return output!;
  }
);
