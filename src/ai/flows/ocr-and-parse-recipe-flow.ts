'use server';
/**
 * @fileOverview An AI agent that analyzes a recipe image in a single vision call,
 * performing OCR and structured parsing together.
 *
 * - ocrAndParseRecipeFromImage - Analyzes recipe data from an image.
 * - OcrAndParseRecipeInput - The input type (image data URI and user language).
 * - ParseRecipeOutput - The return type (structured recipe data, same as text parsing).
 */

import { ai, visionModel } from '@/ai/genkit';
import { z } from 'genkit';
import { type ParseRecipeOutput } from './parse-recipe-from-text-flow'; // Import only the type
import { stripNulls } from './strip-nulls';

// Define Input Schema
const OcrAndParseRecipeInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image of a recipe, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  userLanguageCode: z.string().optional().describe("The user's current UI language code (e.g., 'en', 'no', 'es'). Used to guide the AI in outputting language-specific terms like 'Ingredients' vs 'Ingredienser' if not explicitly found in the OCR text, and for the language of the instructions."),
});
export type OcrAndParseRecipeInput = z.infer<typeof OcrAndParseRecipeInputSchema>;

// Define Output Schema locally for this flow (copied and adapted from parse-recipe-from-text-flow.ts)
const ParsedRecipeOutputSchema = z.object({
  title: z.string().describe("The title of the recipe. Extract this as accurately as possible."),
  description: z.string().nullable().optional().describe("A brief description or introduction to the recipe, if present."),
  ingredientGroups: z.array(
    z.object({
      name: z.string().nullable().optional().describe("The name of this ingredient group (e.g., 'For the dough', 'For the filling'). If the source text does not explicitly name groups, and userLanguageCode is 'no', default to 'Ingredienser'. If 'es', 'Ingredientes'. Otherwise, 'Ingredients' or leave empty."),
      ingredients: z.array(
        z.object({
          name: z.string().describe("The name of the ingredient (e.g., 'flour', 'sugar', 'eggs'). Extract only the primary name. CRITICAL: This 'name' field MUST NOT include the quantity or unit, as those are parsed into separate 'quantity' and 'unit' fields. For example, if OCR text is '150 gr margarin', 'name' should be 'margarin'. If OCR text is structured, e.g., a column 'Ingrediensnavn' contains '100 g smør', the 'name' field is STILL 'smør'. This field MUST NOT contain numbers or units that belong in the other fields."),
          quantity: z.string().nullable().optional().describe("The quantity of the ingredient (e.g., '250', '1 1/4', 'a pinch'). Include numeric values and fractions if present."),
          unit: z.string().nullable().optional().describe("The unit for the quantity (e.g., 'g', 'ts', 'ml', 'stk').")
        })
      ).describe("The list of ingredients in this group. Each ingredient should be an object with name, quantity, and unit.")
    })
  ).describe("An array of ingredient groups. If the recipe is simple and has no explicit groups, put all ingredients into one group."),
  instructions: z.array(
    z.object({
      text: z.string().describe("A single, distinct step in the recipe preparation instructions. The text should be in the language specified by 'userLanguageCode'. Any leading numbers or list markers (e.g., '1.', '-') from the OCR text should be removed. ")
    })
  ).describe("An array of instruction steps. Each step should be an object with a 'text' field. All instruction text should be in the language specified by 'userLanguageCode'."),
  tips: z.array(
    z.object({
      text: z.string().describe("A single tip, suggestion, or variation for the recipe, if any are provided in the source.")
    })
  ).nullable().optional().describe("An array of tips or suggestions, if any."),
  servingsValue: z.number().nullable().optional().describe("The numerical value for the recipe's yield (e.g., if it serves 4 people, this is 4)."),
  servingsUnit: z.enum(['servings', 'pieces']).nullable().optional().describe("The unit for the yield, typically 'servings' (for portions) or 'pieces' (for items like cookies or buns). Default to 'servings' if unclear."),
  prepTime: z.string().nullable().optional().describe("The preparation time, if specified (e.g., '30 mins', '1 hour')."),
  cookTime: z.string().nullable().optional().describe("The cooking time, if specified (e.g., '45 mins', '2 hours')."),
  tags: z.string().nullable().optional().describe("Relevant tags for the recipe, as a single comma-separated string (e.g., 'easy, quick, dessert'). Extract if obvious or explicitly listed."),
  categories: z.string().nullable().optional().describe("Relevant categories for the recipe, as a single comma-separated string (e.g., 'Cakes, Norwegian, Baking'). Extract if obvious or explicitly listed."),
  sourceUrl: z.string().nullable().optional().describe("This field should be omitted or undefined as the source is an image."),
});

// Main exported function
export async function ocrAndParseRecipeFromImage(input: OcrAndParseRecipeInput): Promise<ParseRecipeOutput> {
  return ocrAndParseRecipeFlow(input);
}

// Genkit Prompt — single vision call: OCR + structured parsing in one step.
const recipeImageParserPrompt = ai.definePrompt({
  name: 'recipeImageParserPrompt',
  input: {
    schema: z.object({
      imageDataUri: z.string(),
      userLanguageCode: z.string().optional(),
    }),
  },
  output: { schema: ParsedRecipeOutputSchema },
  prompt: `You are an expert recipe parsing assistant. Your task is to analyze the provided recipe image and structure it into a JSON object matching the provided schema. You must read the text from the image (OCR) and parse it in a single step.
The user's preferred language for UI elements and recipe instructions is '{{{userLanguageCode}}}'. If an ingredient group name is not explicitly found in the image, use a default name appropriate for this language (e.g., 'Ingredienser' for 'no', 'Ingredients' for 'en', 'Ingredientes' for 'es').

CRITICAL INSTRUCTIONS:
1.  **ONLY EXTRACT FROM THE IMAGE:** Only extract information explicitly present in the provided image.
2.  **DO NOT INVENT OR MODIFY:** Do NOT invent, infer, add, or modify any information that is not directly found in the image. Do not attempt to 'complete' or 'enhance' the recipe based on assumptions.
3.  **ACCURACY IS PARAMOUNT:** Prioritize accuracy and fidelity to the content above all else.
4.  **OMIT IF NOT FOUND:** If information for a field is not present in the image, omit the corresponding optional field or leave it empty according to the JSON schema. Do NOT guess or provide default values unless the schema description allows a default.

Carefully extract the following information:
- **title**: The main title of the recipe.
- **description**: Any introductory text or summary.
- **ingredientGroups**:
    - If the recipe has named sections for ingredients, create a group for each.
    - If not, put all ingredients into a single group. Use a default group name appropriate for '{{{userLanguageCode}}}' if no specific group name is apparent (e.g., 'Ingredienser' if '{{{userLanguageCode}}}' is 'no').
    - For each ingredient:
        - **name**: Extract *only* the actual name of the ingredient (e.g., 'margarin', 'sukker', 'hvetemel'). CRITICAL: The 'name' field must NOT include the quantity or unit, as those are parsed into separate 'quantity' and 'unit' fields. For example, if the text for an ingredient line is '150 gr margarin', the 'name' should be 'margarin', 'quantity' should be '150', and 'unit' should be 'gr'. If the text is structured, for example, a column labeled 'Ingrediensnavn' contains '100 g smør', the 'name' field for this ingredient is STILL 'smør'. The numbers '100' and unit 'g' must be extracted to their respective 'quantity' and 'unit' fields and completely excluded from this 'name' field.
        - Do NOT add English translations or any other language in parentheses to the 'name' field unless they were part of the original image text (e.g., 'epler (gjerne gule)' is okay if '(gjerne gule)' was in the image).
        - **quantity**: The quantity of the ingredient (e.g., '250', '1 1/4', 'a pinch').
        - **unit**: The unit for the quantity (e.g., 'g', 'ts', 'ml', 'stk').
- **instructions**: A list of preparation steps.
    - For each instruction step:
        - **text**: Extract the primary instruction text. CRITICAL: The output text for each instruction MUST be in the language specified by '{{{userLanguageCode}}}'. If the text for a step is in a different language, attempt to provide the instruction in '{{{userLanguageCode}}}'.
        - Remove any leading numbers, list markers (like '1.', '-', '*') or automatically generated prefixes. The output should be only the instruction itself.
        - If the text for a step includes a clear parenthetical translation (e.g., an English translation of a Norwegian step like 'Rør smør (Mix butter)' or 'Tilsett eggene (Add eggs)'), EXCLUDE the parenthetical translation from the output. Retain only the primary language instruction (translated to '{{{userLanguageCode}}}' if necessary). If parentheses contain notes or clarifications in the same language as the main instruction (e.g., 'Stek i 20 min (eller til gyllenbrun)'), they should be kept and translated to '{{{userLanguageCode}}}' along with the main instruction.
    - If a line appears to be a note rather than a direct cooking instruction (e.g., "For a large baking pan (with lid) = double portion."), try to place it in the 'tips' section if appropriate, or omit it if it doesn't fit as a tip and cannot be translated into an instruction in '{{{userLanguageCode}}}'.
- **tips**: Any additional tips, variations, or serving suggestions. Text should ideally be in '{{{userLanguageCode}}}'.
- **servingsValue**: The number of servings or pieces.
- **servingsUnit**: "servings" or "pieces".
- **prepTime**: Preparation time.
- **cookTime**: Cooking time.
- **tags**: Comma-separated tags.
- **categories**: Comma-separated categories.
- **sourceUrl**: This field should be omitted or undefined as the source is an image.

Prioritize accuracy based on the image content. If some information is not available, omit optional fields.
Ensure the output strictly adheres to the JSON schema.
The language of the output fields should generally match '{{{userLanguageCode}}}' unless the information is inherently language-neutral (like quantities) or the source text is more specific.

Output JSON:
`,
  messages: ({ imageDataUri }) => [
    {
      role: 'user',
      content: [
        { text: 'Analyze the recipe in this image and extract its structured data.' },
        { media: { url: imageDataUri } },
      ],
    },
  ],
});

// Genkit Flow
const ocrAndParseRecipeFlow = ai.defineFlow(
  {
    name: 'ocrAndParseRecipeFlow',
    inputSchema: OcrAndParseRecipeInputSchema,
    outputSchema: ParsedRecipeOutputSchema,
  },
  async (input: OcrAndParseRecipeInput) => {
    try {
      const { output: parsedOutput } = await recipeImageParserPrompt(input, {
        model: visionModel,
      });

      if (!parsedOutput) {
        throw new Error('AI did not return structured recipe data from the image.');
      }
      if (!parsedOutput.title || !parsedOutput.ingredientGroups || !parsedOutput.instructions) {
        throw new Error('AI output is missing essential recipe fields (title, ingredients, or instructions).');
      }
      return stripNulls(parsedOutput) as ParseRecipeOutput;

    } catch (error) {
      console.error('[ocrAndParseRecipeFlow] Error during image analysis:', error);
      throw error;
    }
  }
);
