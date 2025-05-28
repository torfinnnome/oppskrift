
'use server';

/**
 * @fileOverview An AI agent that suggests a relevant image for a recipe based on its title
 * and returns it as a data URI.
 *
 * - suggestRecipeImage - A function that handles the image suggestion process.
 * - SuggestRecipeImageInput - The input type for the suggestRecipeImage function.
 * - SuggestRecipeImageOutput - The return type for the suggestRecipeImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRecipeImageInputSchema = z.object({
  recipeTitle: z.string().describe('The title of the recipe.'),
});
export type SuggestRecipeImageInput = z.infer<typeof SuggestRecipeImageInputSchema>;

const SuggestRecipeImageOutputSchema = z.object({
  imageUri: z
    .string()
    .describe(
      "A data URI of the suggested image. The image should visually represent the recipe based on its title. CRITICAL: The generated image MUST NOT contain any text, words, letters, or typography. It should be in a landscape orientation (e.g., 16:9 aspect ratio), be LOW-RESOLUTION, and have a SMALL FILE SIZE (ideally under 500KB) to be stored directly. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type SuggestRecipeImageOutput = z.infer<typeof SuggestRecipeImageOutputSchema>;

export async function suggestRecipeImage(input: SuggestRecipeImageInput): Promise<SuggestRecipeImageOutput> {
  return suggestRecipeImageFlow(input);
}

const suggestRecipeImageFlow = ai.defineFlow(
  {
    name: 'suggestRecipeImageFlow',
    inputSchema: SuggestRecipeImageInputSchema,
    outputSchema: SuggestRecipeImageOutputSchema,
  },
  async (input: SuggestRecipeImageInput) => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: `IMPORTANT: Generate a PURELY VISUAL, LOW-RESOLUTION image (ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY) that represents the recipe titled: "${input.recipeTitle}". The image should be in landscape orientation, wider than it is tall, for example with a 16:9 aspect ratio. CRITICAL: The image MUST have a small file size, suitable for a data URI and ideally under 500KB.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // Must provide both
      },
    });

    if (!media.url || !media.url.startsWith('data:')) {
        throw new Error('AI did not return a valid data URI for the image.');
    }

    // Validate size (approximate check, actual byte size is after base64 decoding)
    // Base64 string length is roughly 4/3 times the original data size.
    // 1MB field limit = 1048576 bytes. Target 500KB for data URI string length to be safe.
    // 500KB * 4/3 = ~666KB string length. Max Firestore string is ~1MB.
    // Let's check if the data URI string itself is > 700,000 characters (rough check)
    if (media.url.length > 700000) { // Approx 700KB string, might be ~500KB data
        console.warn(`Generated image data URI for "${input.recipeTitle}" is very large (length: ${media.url.length}). It might exceed Firestore limits even after client-side resizing. Consider Firebase Storage if this limit is frequently hit.`);
        // We'll still return it, but this warning is important.
        // Client-side resizing will attempt to shrink it.
    }

    return {imageUri: media.url};
  }
);

    