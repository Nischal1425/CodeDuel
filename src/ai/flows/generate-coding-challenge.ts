
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
  // language: z.enum(["javascript", "python", "cpp"]).optional().describe("Optional: The preferred programming language for the challenge's solution. Defaults to JavaScript if not specified.")
});
export type GenerateCodingChallengeInput = z.infer<
  typeof GenerateCodingChallengeInputSchema
>;

const TestCaseSchema = z.object({
  name: z.string().describe("A descriptive name for the test case (e.g., 'Test Case 1: Basic Input', 'Test Case 2: Edge Case with Empty Array')."),
  input: z.string().describe("The input for the test case. If the input is complex (e.g., object, array), represent it as a JSON string. Otherwise, a simple string for primitive types. The player's 'solve(params)' function will likely receive JSON.parse(input) if it's JSON."),
  expectedOutput: z.string().describe("The expected output for the test case. If the output is complex, represent it as a JSON string. Otherwise, a simple string."),
  isPublic: z.boolean().default(true).describe("Whether this test case is visible to the player before submission. Defaults to true."),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

const GenerateCodingChallengeOutputSchema = z.object({
  problemStatement: z
    .string()
    .describe('The coding problem statement, including input and output specifications, constraints, and clear examples. This statement should be language-agnostic enough to be solvable in JavaScript, Python, or C++.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the problem, matching the targetDifficulty.'),
  solution: z.string().describe('The reference solution code for the problem, primarily in JavaScript. This solution should be correct and efficient for the given problem and difficulty.'),
  testCases: z.array(TestCaseSchema).min(2).max(4).describe("An array of 2 to 4 public test cases. Each test case should include a name, string input (JSON string for complex inputs), string expectedOutput (JSON string for complex outputs), and isPublic flag."),
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

The coding problem must be very challenging and well suited for a 1v1 coding battle.
The reference solution MUST be in JavaScript. The problem statement itself should be language-agnostic, suitable for solving in JavaScript, Python, or C++.
**The problem should be inspired by real-world scenarios, case studies, or challenges one might encounter in innovative tech environments, similar to those at leading technology companies. Focus on practical application and creative problem-solving.**

Player Rank: {{{playerRank}}}
Target Difficulty: {{{targetDifficulty}}}
Preferred Solution Language (for reference solution): JavaScript

Generate a coding problem with the following specifications:
- problemStatement: A clear and concise description of the coding problem. Include detailed input and output specifications, constraints, and at least one clear example with input and expected output. Ensure the problem statement is understandable and solvable by someone using JavaScript, Python, or C++. The 'solve(params)' function signature mentioned in the problem (if any) should be generic, e.g., params might be a single value, an array, or an object (parsed from a JSON string if complex).
- difficulty: The difficulty level of the problem (must be exactly 'easy', 'medium', or 'hard', matching the targetDifficulty).
- solution: A reference solution code for the problem, written in JavaScript. The solution should be functionally correct and reasonably efficient for the stated difficulty. For example: "function solve(params) { /* solution code */ return result; }". Ensure this function handles various input types (e.g. if params is a string, number, array, or object passed from JSON.parse(testCase.input)).
- testCases: Generate 2-3 public test cases (isPublic: true).
    - Each testCase needs a 'name'.
    - 'input': Input for the test case. If complex (object/array), provide as a JSON STRING. If simple (number/string), provide as a plain string. Example: for input like \`{ "arr": [1,2,3], "k": 2 }\`, the string should be \`'{"arr": [1,2,3], "k": 2}'\`. For input \`5\`, the string should be \`'5'\`.
    - 'expectedOutput': Expected output. If complex, provide as a JSON STRING. If simple, provide as a plain string. Example: for output \`[3,4]\`, the string should be \`'[3,4]'\`. For output \`10\`, the string should be \`'10'\`.

Ensure the problem includes obfuscation (logic twist, variable rename, disguised context) to make it AI-resistant but still solvable by a human.
The problem statement should be comprehensive enough for a developer to understand and solve the problem without ambiguity.
The JavaScript reference solution should be a complete, runnable function if applicable.

Output the problem in the specified JSON format.
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
    if (output && output.difficulty !== input.targetDifficulty) {
        console.warn(`Generated difficulty ${output.difficulty} does not match target ${input.targetDifficulty}`);
    }
    // Validate test cases input/output format (basic check)
    if (output && output.testCases) {
        output.testCases.forEach(tc => {
            // Ensure inputs/outputs are strings as requested by prompt
            if (typeof tc.input !== 'string') {
                console.warn(`Test case input for "${tc.name}" is not a string. Forcing to string.`);
                tc.input = String(tc.input);
            }
            if (typeof tc.expectedOutput !== 'string') {
                console.warn(`Test case expectedOutput for "${tc.name}" is not a string. Forcing to string.`);
                tc.expectedOutput = String(tc.expectedOutput);
            }
        });
    }
    return output!;
  }
);
