'use server';
/**
 * @fileOverview A Genkit flow for generating a custom user avatar.
 *
 * - generateAvatar - A function that takes a text prompt and generates an image, returning the data URI.
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
  // This now returns the full data URI for the client to handle uploading.
  imageDataUri: z
    .string()
    .describe(
      "A data URI of the generated avatar image. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateAvatarOutput = z.infer<typeof GenerateAvatarOutputSchema>;

// This function is now much simpler. It just generates the image data.
// The upload logic is moved to the client-side component.
export async function generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarOutput> {
  const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `Generate a square profile avatar based on the following description: ${input.prompt}. The style should be a simple, flat, 2D vector style to ensure a smaller file size and quick generation.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed. No media was returned from the AI model.');
    }

    return { imageDataUri: media.url };
}
