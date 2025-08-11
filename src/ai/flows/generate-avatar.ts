'use server';
/**
 * @fileOverview A Genkit flow for generating a custom user avatar and uploading it to Firebase Storage.
 *
 * - generateAvatar - A function that takes a text prompt, generates an image, uploads it, and returns the public URL.
 * - GenerateAvatarInput - The input type for the generateAvatar function.
 * - GenerateAvatarOutput - The return type for the generateAvatar function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';


const GenerateAvatarInputSchema = z.object({
  prompt: z.string().describe('The text prompt for generating the avatar image.'),
  userId: z.string().describe('The ID of the user for whom the avatar is being generated.'),
});
export type GenerateAvatarInput = z.infer<typeof GenerateAvatarInputSchema>;

const GenerateAvatarOutputSchema = z.object({
  // This now returns a URL, not the full data URI.
  imageUrl: z
    .string()
    .url()
    .describe(
      "The public URL of the generated avatar image after it has been uploaded to storage."
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
  async ({prompt, userId}) => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `Generate a square profile avatar based on the following description: ${prompt}. The style should be a simple, flat, 2D vector style to ensure a smaller file size and quick generation.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed. No media was returned from the AI model.');
    }

    // The media.url is a data URI like 'data:image/png;base64,iVBORw0KGgo...'.
    const imageDataUri = media.url;
    
    // Create a reference to the file in Firebase Storage
    const storageRef = ref(storage, `avatars/${userId}-${Date.now()}.png`);

    // Upload the base64 string to Firebase Storage. We must slice the 'data:...' prefix.
    const uploadResult = await uploadString(storageRef, imageDataUri, 'data_url');

    // Get the public download URL
    const downloadUrl = await getDownloadURL(uploadResult.ref);

    return { imageUrl: downloadUrl };
  }
);
