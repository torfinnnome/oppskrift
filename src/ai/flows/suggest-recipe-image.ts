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
    // NOTE: Image generation requires a provider that supports it (e.g., OpenAI DALL-E).
    // Not all OpenAI-compatible endpoints support image generation. To enable:
    // 1. Ensure OPENAI_BASE_URL points to a provider with image generation (e.g., OpenAI).
    // 2. Use the compat-oai openAI plugin's image model support (dall-e-3, gpt-image-1).
    // 3. Uncomment and adapt the implementation below.

    console.warn('[suggestRecipeImageFlow] Image generation is not configured. This feature requires an OpenAI-compatible provider with image generation support (e.g., OpenAI DALL-E).');

    try {
      // For now, return a placeholder approach
      throw new Error('Image generation is not configured. Set OPENAI_API_KEY and OPENAI_BASE_URL to a provider that supports image generation (e.g., OpenAI with dall-e-3).');
      
      /*
      // Example implementation using the compat-oai OpenAI plugin (uncomment and adapt):
      // First, add `openAI` to the plugins array in genkit.ts:
      //   import { openAI } from '@genkit-ai/compat-oai/openai';
      //   plugins: [openAICompatible({...}), openAI()]
      // Then use the OpenAI image model:
      const {media} = await ai.generate({
        model: 'openai/dall-e-3',
        prompt: `IMPORTANT: Generate a PURELY VISUAL, LOW-RESOLUTION image (ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY) that represents the recipe titled: "${input.recipeTitle}". The image should be in landscape orientation, wider than it is tall, for example with a 16:9 aspect ratio. CRITICAL: The image MUST have a small file size, suitable for a data URI and ideally under 500KB.`,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      if (!media || !media.url || !media.url.startsWith('data:')) {
          console.error('[suggestRecipeImageFlow] AI did not return a valid data URI for the image. Media object:', media);
          throw new Error('AI did not return a valid data URI for the image.');
      }

      console.log(`[suggestRecipeImageFlow] Successfully generated image for title: "${input.recipeTitle}", Data URI length: ${media?.url?.length}`);
      return {imageUri: media?.url || ''};
      */

    } catch (error) {
      console.error('[suggestRecipeImageFlow] Error during image generation:', error);
      // Re-throw the original error to be handled by the calling component
      throw error;
    }
  }
);
