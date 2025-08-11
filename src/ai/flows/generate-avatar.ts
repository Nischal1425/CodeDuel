'use server';
/**
 * @fileOverview A Genkit flow for generating a custom user avatar from a text prompt.
 *
 * - generateAvatar - A function that takes a text prompt and returns an image data URI.
 * - GenerateAvatarInput - The input type for the generateAvatar function.
 * - GenerateAvatarOutput - The return type for the generateAvatar function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAvatarInputSchema = z.object({
  prompt: z.string().describe('The text prompt for generating the avatar image.'),
});
export type GenerateAvatarInput = z.infer<typeof GenerateAvatarInputSchema>;

const GenerateAvatarOutputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "The generated avatar image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:image/png;base64,<encoded_data>'."
    ),
});
export type GenerateAvatarOutput = z.infer<typeof GenerateAvatarOutputSchema>;

export async function generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarOutput> {
  return generateAvatarFlow(input);
}

const generateAvatarFlow = ai.defineFlow(
  {
    name: 'generateAvatarFlow',
    inputSchema: GenerateAvatarInputSchema,
    outputSchema: GenerateAvatarOutputSchema,
  },
  async ({prompt}) => {
    const {media} = await ai.generate({
      // IMPORTANT: Use the specific model for image generation.
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `Generate a square profile avatar based on the following description: ${prompt}. The style should be a simple, flat, 2D vector style to ensure a smaller file size.`,
      config: {
        // IMPORTANT: Must include both TEXT and IMAGE.
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed. No media was returned from the AI model.');
    }

    return { imageDataUri: media.url };
  }
);
