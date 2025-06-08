
'use server';
/**
 * @fileOverview An AI agent that performs OCR on an image and then parses the
 * extracted text to structure it into a recipe form.
 *
 * - ocrAndParseRecipeFromImage - Performs OCR and parses recipe data from an image.
 * - OcrAndParseRecipeInput - The input type (image data URI and user language).
 * - ParseRecipeOutput - The return type (structured recipe data, same as text parsing).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { type ParseRecipeOutput } from './parse-recipe-from-text-flow'; // Import only the type

// Define Input Schema
const OcrAndParseRecipeInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image of a recipe, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  userLanguageCode: z.string().optional().describe("The user's current UI language code (e.g., 'en', 'no', 'es'). Used to guide the AI in outputting language-specific terms like 'Ingredients' vs 'Ingredienser' if not explicitly found in the OCR text."),
});
export type OcrAndParseRecipeInput = z.infer<typeof OcrAndParseRecipeInputSchema>;

// Define Output Schema locally for this flow (copied and adapted from parse-recipe-from-text-flow.ts)
const ParsedRecipeOutputSchema = z.object({
  title: z.string().describe("The title of the recipe. Extract this as accurately as possible."),
  description: z.string().optional().describe("A brief description or introduction to the recipe, if present."),
  ingredientGroups: z.array(
    z.object({
      name: z.string().optional().describe("The name of this ingredient group (e.g., 'For the dough', 'For the filling'). If the source text does not explicitly name groups, and userLanguageCode is 'no', default to 'Ingredienser'. If 'es', 'Ingredientes'. Otherwise, 'Ingredients' or leave empty."),
      ingredients: z.array(
        z.object({
          name: z.string().describe("The name of the ingredient (e.g., 'flour', 'sugar', 'eggs'). Extract only the primary name; do NOT include translations in parentheses."),
          quantity: z.string().optional().describe("The quantity of the ingredient (e.g., '250', '1 1/4', 'a pinch'). Include numeric values and fractions if present."),
          unit: z.string().optional().describe("The unit for the quantity (e.g., 'g', 'ts', 'ml', 'stk').")
        })
      ).describe("The list of ingredients in this group. Each ingredient should be an object with name, quantity, and unit.")
    })
  ).describe("An array of ingredient groups. If the recipe is simple and has no explicit groups, put all ingredients into one group."),
  instructions: z.array(
    z.object({
      text: z.string().describe("A single, distinct step in the recipe preparation instructions. Preserve original numbering if present, but return only the text of the step.")
    })
  ).describe("An array of instruction steps. Each step should be an object with a 'text' field."),
  tips: z.array(
    z.object({
      text: z.string().describe("A single tip, suggestion, or variation for the recipe, if any are provided in the source.")
    })
  ).optional().describe("An array of tips or suggestions, if any."),
  servingsValue: z.number().optional().describe("The numerical value for the recipe's yield (e.g., if it serves 4 people, this is 4)."),
  servingsUnit: z.enum(['servings', 'pieces']).optional().describe("The unit for the yield, typically 'servings' (for portions) or 'pieces' (for items like cookies or buns). Default to 'servings' if unclear."),
  prepTime: z.string().optional().describe("The preparation time, if specified (e.g., '30 mins', '1 hour')."),
  cookTime: z.string().optional().describe("The cooking time, if specified (e.g., '45 mins', '2 hours')."),
  tags: z.string().optional().describe("Relevant tags for the recipe, as a single comma-separated string (e.g., 'easy, quick, dessert'). Extract if obvious or explicitly listed."),
  categories: z.string().optional().describe("Relevant categories for the recipe, as a single comma-separated string (e.g., 'Cakes, Norwegian, Baking'). Extract if obvious or explicitly listed."),
  sourceUrl: z.string().optional().describe("This field should be omitted or undefined as the source is an image."),
});

// Main exported function
export async function ocrAndParseRecipeFromImage(input: OcrAndParseRecipeInput): Promise<ParseRecipeOutput> {
  return ocrAndParseRecipeFlow(input);
}

// Genkit Flow
const ocrAndParseRecipeFlow = ai.defineFlow(
  {
    name: 'ocrAndParseRecipeFlow',
    inputSchema: OcrAndParseRecipeInputSchema,
    outputSchema: ParsedRecipeOutputSchema,
  },
  async (input: OcrAndParseRecipeInput) => {
    try {
      // Step 1: Perform OCR on the image to extract text
      const { text: ocrText } = await ai.generate({
        model: 'googleai/gemini-2.0-flash', 
        prompt: [
          { text: "Extract all text from the following image. Present the text as clearly as possible for recipe parsing." },
          { media: { url: input.imageDataUri } }
        ],
        config: {
          temperature: 0.2, 
        }
      });

      if (!ocrText || ocrText.trim() === "") {
        throw new Error('AI did not extract any text from the image (OCR failed or image was empty).');
      }

      const parsingInput = { inputText: ocrText, userLanguageCode: input.userLanguageCode };

      const recipeParserPromptForOcr = ai.definePrompt({
        name: 'recipeParserPromptForOcr',
        input: { schema: z.object({ inputText: z.string(), userLanguageCode: z.string().optional() }) },
        output: { schema: ParsedRecipeOutputSchema },
        prompt: `You are an expert recipe parsing assistant. Your task is to analyze the provided text, which was extracted via OCR from an image, and structure it into a JSON object matching the provided schema.
The user's preferred language for UI elements is '{{{userLanguageCode}}}'. If an ingredient group name is not explicitly found in the text, use a default name appropriate for this language (e.g., 'Ingredienser' for 'no', 'Ingredients' for 'en', 'Ingredientes' for 'es').

Extracted OCR text:
\`\`\`
{{{inputText}}}
\`\`\`

Carefully extract the following information:
- **title**: The main title of the recipe.
- **description**: Any introductory text or summary.
- **ingredientGroups**:
    - If the recipe has named sections for ingredients, create a group for each.
    - If not, put all ingredients into a single group. Use a default group name appropriate for '{{{userLanguageCode}}}' if no specific group name is apparent (e.g., 'Ingredienser' if '{{{userLanguageCode}}}' is 'no').
    - For each ingredient, try to separate its name, quantity, and unit. CRITICAL: The ingredient name should be extracted as it appears in the OCR text. Do NOT add English translations or any other language in parentheses. For example, if the OCR text says 'mel', the ingredient name should be 'mel', not 'mel (flour)'. If the OCR text itself contains parentheses, like 'epler (gjerne gule)', include the parenthetical part as it is part of the name.
- **instructions**: A list of preparation steps.
- **tips**: Any additional tips, variations, or serving suggestions.
- **servingsValue**: The number of servings or pieces.
- **servingsUnit**: "servings" or "pieces".
- **prepTime**: Preparation time.
- **cookTime**: Cooking time.
- **tags**: Comma-separated tags.
- **categories**: Comma-separated categories.
- **sourceUrl**: This field should be omitted or undefined as the source is an image.

Prioritize accuracy. If some information is not available, omit optional fields.
Ensure the output strictly adheres to the JSON schema.
The language of the output fields should match the language of the input recipe if discernible, otherwise use '{{{userLanguageCode}}}' as a guide for defaults.

Output JSON:
`,
      });
      
      const { output: parsedOutput } = await recipeParserPromptForOcr(parsingInput);

      if (!parsedOutput) {
        throw new Error('AI did not return structured recipe data after OCR parsing.');
      }
      if (!parsedOutput.title || !parsedOutput.ingredientGroups || !parsedOutput.instructions) {
        throw new Error('AI output (post-OCR) is missing essential recipe fields (title, ingredients, or instructions).');
      }
      return parsedOutput as ParseRecipeOutput; 

    } catch (error) {
      console.error('[ocrAndParseRecipeFlow] Error during OCR and parsing:', error);
      throw error;
    }
  }
);

