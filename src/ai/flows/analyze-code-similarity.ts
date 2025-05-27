// use server'

/**
 * @fileOverview This file defines a Genkit flow for analyzing code similarity between submissions to detect potential cheating.
 *
 * - analyzeCodeSimilarity - A function that takes two code submissions as input and returns a similarity score.
 * - AnalyzeCodeSimilarityInput - The input type for the analyzeCodeSimilarity function.
 * - AnalyzeCodeSimilarityOutput - The return type for the analyzeCodeSimilarity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCodeSimilarityInputSchema = z.object({
  code1: z.string().describe('The first code submission.'),
  code2: z.string().describe('The second code submission.'),
});
export type AnalyzeCodeSimilarityInput = z.infer<typeof AnalyzeCodeSimilarityInputSchema>;

const AnalyzeCodeSimilarityOutputSchema = z.object({
  similarityScore: z
    .number()
    .min(0)
    .max(1)
    .describe(
      'A score between 0 and 1 indicating the similarity between the two code submissions.  Higher values indicate greater similarity.'
    ),
  explanation: z.string().describe('An explanation of why the code is similar or different.'),
});
export type AnalyzeCodeSimilarityOutput = z.infer<typeof AnalyzeCodeSimilarityOutputSchema>;

export async function analyzeCodeSimilarity(
  input: AnalyzeCodeSimilarityInput
): Promise<AnalyzeCodeSimilarityOutput> {
  return analyzeCodeSimilarityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCodeSimilarityPrompt',
  input: {schema: AnalyzeCodeSimilarityInputSchema},
  output: {schema: AnalyzeCodeSimilarityOutputSchema},
  prompt: `You are an expert in code analysis and plagiarism detection.

You are given two code submissions and must determine how similar they are.

Provide a similarity score between 0 and 1, where 0 means completely different and 1 means identical.
Also, provide a brief explanation of why the code is similar or different, pointing out specific code elements, logic, or structure.

Code Submission 1:
{{code1}}

Code Submission 2:
{{code2}}`,
});

const analyzeCodeSimilarityFlow = ai.defineFlow(
  {
    name: 'analyzeCodeSimilarityFlow',
    inputSchema: AnalyzeCodeSimilarityInputSchema,
    outputSchema: AnalyzeCodeSimilarityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
