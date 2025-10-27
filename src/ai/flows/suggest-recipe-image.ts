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
    // NOTE: Mistral AI does not currently offer image generation capabilities like Google Gemini.
    // This function would need to be reimplemented using a different service for image generation.
    // Options include:
    // 1. OpenAI DALL-E
    // 2. Stability AI
    // 3. Replicate
    // 4. Remove image generation and use placeholder images instead
    
    console.warn('[suggestRecipeImageFlow] Mistral AI does not support image generation. This feature needs to be reimplemented with an alternative service.');
    
    try {
      // For now, return a placeholder approach
      // In a real implementation, you would integrate with a different image generation service
      throw new Error('Image generation not available with Mistral AI. Please integrate with an alternative image generation service like OpenAI DALL-E, Stability AI, or use placeholder images.');
      
      /* 
      // Example implementation with OpenAI DALL-E (uncomment and implement if using OpenAI):
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
