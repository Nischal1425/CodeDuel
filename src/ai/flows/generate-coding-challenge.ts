
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

const TestCaseSchema = z.object({
  name: z.string().describe("A descriptive name for the test case (e.g., 'Test Case 1: Basic Input', 'Test Case 2: Edge Case with Empty Array')."),
  input: z.string().describe("The input for the test case. If the input is complex (e.g., object, array with multiple conceptual parameters), represent it as a JSON string where keys are conceptual parameter names. Otherwise, a simple string for primitive types. The player's 'solve(params)' function will receive JSON.parse(input) if it's JSON, or the raw string if it's a primitive."),
  expectedOutput: z.string().describe("The expected output for the test case. If the output is complex, represent it as a JSON string. Otherwise, a simple string."),
  isPublic: z.boolean().default(true).describe("Whether this test case is visible to the player before submission. Defaults to true."),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

const GenerateCodingChallengeOutputSchema = z.object({
  problemStatement: z
    .string()
    .describe('A coding problem statement formatted in Markdown. It MUST include the following sections, each starting with a "###" heading: "### Description", "### Examples", and "### Constraints". Under "### Examples", format each example clearly with sections like "**Input:**" and "**Output:**", using Markdown code blocks (```) for the code/data itself.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the problem, matching the targetDifficulty.'),
  solution: z.string().describe('The reference solution code for the problem, primarily in JavaScript. This solution function MUST be named `solve` and accept a single argument `params`. If the problem has multiple conceptual inputs (e.g. `nums`, `target`), `params` will be an object like `{ "nums": ..., "target": ...}`. If it has a single primitive input, `params` will be that primitive.'),
  testCases: z.array(TestCaseSchema).min(2).max(4).describe("An array of 2 to 4 public test cases. Each test case should include a name, string input (JSON string for complex inputs with named parameters, or primitive string for simple inputs), string expectedOutput (JSON string for complex outputs, or primitive string for simple outputs), and isPublic flag."),
  functionSignature: z.string().optional().describe("A string representing the primary function signature the player should implement. Examples: for JS: 'function twoSum(nums, target)', for Python: 'def get_average(scores):', for C++: 'std::vector<int> twoSum(std::vector<int>& nums, int target)'. For C++, this signature will typically be placed inside a 'class Solution { public: ... };' structure by the placeholder generator. This signature should align with the conceptual inputs described in problemStatement and used in testCases."),
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
- problemStatement: A clear description of the coding problem, formatted in Markdown. This string **MUST** include the following sections, each starting with a '###' heading: \`### Description\`, \`### Examples\`, and \`### Constraints\`.
    - Under \`### Description\`, provide a detailed, language-agnostic description of the task.
    - Under \`### Examples\`, provide at least one clear example. Format each example with bolded labels like \`**Input:**\`, \`**Output:**\`, and optionally \`**Explanation:**\`. Use markdown code blocks (\`\`\` or \`) for the data itself.
    - Under \`### Constraints\`, provide a bulleted list of constraints (e.g., '- \`1 <= nums.length <= 1000\`').
- difficulty: The difficulty level of the problem (must be exactly 'easy', 'medium', or 'hard', matching the targetDifficulty).
- solution: A reference solution code for the problem, written in JavaScript. The primary JavaScript solution function *must* be named 'solve' and accept a single argument 'params'.
    - If the problem involves multiple conceptual inputs (e.g., an array \`nums\` and an integer \`target\`), the \`params\` argument for the \`solve\` function will be an object like \`{ "nums": [1,2,3], "target": 5 }\`. The \`solve\` function must then extract these (e.g., \`const nums = params.nums;\`).
    - If the problem involves a single primitive input (e.g., a number \`n\`), the \`params\` argument will be that primitive value directly (e.g., \`params = 5\`).
    The reference \`solve\` function must correctly handle \`params\` based on this structure.
- testCases: Generate 2-3 public test cases (isPublic: true).
    - Each testCase needs a 'name'.
    - 'input': Input for the test case.
        - If the problem has multiple conceptual parameters (e.g., \`nums\` and \`target\`), this MUST be a JSON STRING representing an object mapping these parameter names to their values. Example: For inputs \`nums = [1,2,3]\` and \`k = 2\`, the input string should be \`'{"nums": [1,2,3], "k": 2}'\`.
        - If the problem has a single primitive input (e.g., \`5\` or \`"hello"\`), this should be a plain string representation of that primitive. Example: for input \`5\`, the string should be \`'5'\`. For input \`"hello"\` that is meant as a string literal, the string should be \`'"hello"'\` (including the quotes if it's a string literal).
    - 'expectedOutput': Expected output. If complex, provide as a JSON STRING. If simple, provide as a plain string. Example: for output \`[3,4]\`, the string should be \`'[3,4]'\`. For output \`10\`, the string should be \`'10'\`.
    - 'isPublic': Must be true.
- functionSignature: (Highly recommended) A string representing the primary function signature the player should implement.
    Examples:
    - For JavaScript: 'function twoSum(nums, target)'
    - For Python: 'def get_average(scores):'
    - For C++: 'std::vector<int> twoSum(std::vector<int>& nums, int target)'
    This signature should align with the conceptual inputs defined in the problem statement and the structure of the 'input' field in testCases. The name and parameters should be descriptive. For C++, assume this signature will be placed within a 'class Solution { public: ... };' structure by the application code editor placeholder.

Ensure the problem includes obfuscation (logic twist, variable rename, disguised context) to make it AI-resistant but still solvable by a human.
The problem statement should be comprehensive enough for a developer to understand and solve the problem without ambiguity.
The JavaScript reference solution (\`solve\` function) should be complete and runnable.

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
    console.log('input', input);
    const {output} = await prompt(input);
    console.log('output', output);

    // Check if output is null/undefined after the prompt call.
    // This handles cases where the prompt doesn't throw an error but returns no valid output
    // (e.g., due to content filtering by the model itself, or other non-exception issues).
    if (!output) {
      console.error('AI prompt for generateCodingChallenge returned no output.');
      throw new Error('Failed to generate coding challenge content. The AI model did not provide a valid response.');
    }

    if (output.difficulty !== input.targetDifficulty) {
        console.warn(`Generated difficulty ${output.difficulty} does not match target ${input.targetDifficulty}. Overriding to target.`);
        output.difficulty = input.targetDifficulty; // Ensure difficulty matches target
    }
    // Validate test cases input/output format (basic check to ensure they are strings)
    if (output.testCases) {
        output.testCases.forEach(tc => {
            if (typeof tc.input !== 'string') {
                console.warn(`Test case input for "${tc.name}" is not a string: ${tc.input}. Forcing to string.`);
                tc.input = String(tc.input);
            }
            if (typeof tc.expectedOutput !== 'string') {
                console.warn(`Test case expectedOutput for "${tc.name}" is not a string: ${tc.expectedOutput}. Forcing to string.`);
                tc.expectedOutput = String(tc.expectedOutput);
            }
        });
    }
    return output; // No longer using 'output!' as we've checked for !output above.
  }
);
