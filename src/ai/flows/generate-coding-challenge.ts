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
});
export type GenerateCodingChallengeInput = z.infer<
  typeof GenerateCodingChallengeInputSchema
>;

const GenerateCodingChallengeOutputSchema = z.object({
  problemStatement: z
    .string()
    .describe('The coding problem statement, including input and output specifications.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the problem.'),
  solution: z.string().describe('The reference solution code for the problem.'),
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
  prompt: `You are an expert coding challenge generator. You will generate a unique coding problem tailored to the player's skill level. The difficulty of the problem should align with the player's rank: a higher rank should correspond to a harder problem. The coding problem must be very challenging and well suited for a 1v1 coding battle.

Player Rank: {{{playerRank}}}

Generate a coding problem with the following specifications:
- problemStatement: A clear and concise description of the coding problem, including input and output specifications.
- difficulty: The difficulty level of the problem (easy, medium, or hard).
- solution: A reference solution code for the problem.

Ensure the problem includes obfuscation (logic twist, variable rename, disguised context) to make it AI-resistant.

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
    return output!;
  }
);
