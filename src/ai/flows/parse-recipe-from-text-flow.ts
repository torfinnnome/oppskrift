
'use server';
/**
 * @fileOverview An AI agent that parses recipe text or a recipe URL
 * and attempts to structure it into a recipe form.
 *
 * - parseRecipeFromText - Parses recipe input (text or URL) into structured data.
 * - ParseRecipeInput - The input type.
 * - ParseRecipeOutput - The return type (structured recipe data).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define Input Schema
const ParseRecipeInputSchema = z.object({
  inputText: z.string().min(10, {message: "Input text is too short to be a valid recipe or URL."}).describe('The recipe text to parse, or a URL to a recipe page. The AI will attempt to fetch and parse content if a URL is provided, or parse the direct text.'),
});
export type ParseRecipeInput = z.infer<typeof ParseRecipeInputSchema>;

// Define Output Schema (aligns with RecipeFormValues where possible, with descriptions for AI)
const ParsedRecipeOutputSchema = z.object({
  title: z.string().describe("The title of the recipe. Extract this as accurately as possible from the source."),
  description: z.string().optional().describe("A brief description or introduction to the recipe, if present in the source. Extract only."),
  ingredientGroups: z.array(
    z.object({
      name: z.string().optional().describe("The name of this ingredient group (e.g., 'For the dough', 'For the filling') if explicitly stated in the source. If the source text does not explicitly name groups, you can create a single group named 'Ingredients' or leave this empty."),
      ingredients: z.array(
        z.object({
          name: z.string().describe("The name of the ingredient (e.g., 'flour', 'sugar', 'eggs'). CRITICAL: This 'name' field must contain *only* the primary name of the ingredient. It should NOT include the quantity or unit, as those should be parsed into the separate 'quantity' and 'unit' fields. For example, if the source text for an ingredient is '250 g flour', the 'name' should be 'flour', 'quantity' should be '250', and 'unit' should be 'g'. This field MUST NOT contain numbers or units that belong in the other fields."),
          quantity: z.string().optional().describe("The quantity of the ingredient (e.g., '250', '1 1/4', 'a pinch') as found in the source. Include numeric values and fractions if present."),
          unit: z.string().optional().describe("The unit for the quantity (e.g., 'g', 'ts', 'ml', 'stk') as found in the source.")
        })
      ).describe("The list of ingredients in this group. Each ingredient should be an object with name, quantity, and unit, extracted directly from the source.")
    })
  ).describe("An array of ingredient groups. If the recipe is simple and has no explicit groups, put all ingredients into one group. The group name can be omitted or set to something generic like 'Ingredients' if not specified in the source."),
  instructions: z.array(
    z.object({
      text: z.string().describe("A single, distinct step in the recipe preparation instructions. Preserve original numbering if present, but return only the text of the step as found in the source.")
    })
  ).describe("An array of instruction steps. Each step should be an object with a 'text' field, extracted directly from the source."),
  tips: z.array(
    z.object({
      text: z.string().describe("A single tip, suggestion, or variation for the recipe, if any are provided in the source. Extract only.")
    })
  ).optional().describe("An array of tips or suggestions, if any are explicitly found in the source."),
  servingsValue: z.number().optional().describe("The numerical value for the recipe's yield (e.g., if it serves 4 people, this is 4), if specified in the source."),
  servingsUnit: z.enum(['servings', 'pieces']).optional().describe("The unit for the yield, typically 'servings' or 'pieces', if specified. Default to 'servings' if unclear from source."),
  prepTime: z.string().optional().describe("The preparation time, if specified in the source (e.g., '30 mins', '1 hour')."),
  cookTime: z.string().optional().describe("The cooking time, if specified in the source (e.g., '45 mins', '2 hours')."),
  tags: z.string().optional().describe("Relevant tags for the recipe, as a single comma-separated string (e.g., 'easy, quick, dessert'). Extract if obvious or explicitly listed in the source."),
  categories: z.string().optional().describe("Relevant categories for the recipe, as a single comma-separated string (e.g., 'Cakes, Norwegian, Baking'). Extract if obvious or explicitly listed in the source."),
  sourceUrl: z.string().optional().describe("If the `inputText` appears to be a valid HTTP/HTTPS URL, this field should contain that exact URL. Otherwise, this field should be omitted or undefined."),
  extractedImageUrl: z.string().optional().describe("If the input was a URL, this should be the URL of the main recipe image found on the page. Prioritize 'og:image' meta tags, then the most prominent image clearly associated with the recipe title or content. Ensure it's a direct image file link (e.g., .jpg, .png). Otherwise, omit this field."),
});
export type ParseRecipeOutput = z.infer<typeof ParsedRecipeOutputSchema>;


// Main exported function
export async function parseRecipeFromText(input: ParseRecipeInput): Promise<ParseRecipeOutput> {
  return parseRecipeFlow(input);
}

// Genkit Prompt
const recipeParserPrompt = ai.definePrompt({
  name: 'recipeParserPrompt',
  input: { schema: ParseRecipeInputSchema },
  output: { schema: ParsedRecipeOutputSchema },
  prompt: `You are an expert recipe parsing assistant. Your SOLE TASK is to ACCURATELY EXTRACT information from the provided input (raw text or content fetched from a URL) and structure it into a JSON object matching the provided schema.

CRITICAL INSTRUCTIONS:
1.  **ONLY EXTRACT:** Only extract information explicitly present in the source text or the content of the fetched URL.
2.  **DO NOT INVENT OR MODIFY:** Do NOT invent, infer, add, or modify any information that is not directly found in the source. Do not attempt to 'complete' or 'enhance' the recipe.
3.  **ACCURACY IS PARAMOUNT:** Prioritize accuracy and fidelity to the source content above all else.
4.  **OMIT IF NOT FOUND:** If information for a field is not present in the source, omit the corresponding optional field or leave it empty according to the JSON schema. Do NOT guess or provide default values unless the schema description explicitly allows a default for ambiguous cases (e.g., servingsUnit).
5.  **URLS:** If the input is a URL, fetch its content and parse information ONLY from that fetched content.

Input text/URL:
\`\`\`
{{{inputText}}}
\`\`\`

Carefully extract the following information based STRICTLY on the source:
- **title**: The main title of the recipe.
- **description**: Any introductory text or summary, if present.
- **ingredientGroups**:
    - If the recipe has named sections for ingredients (e.g., "For the cake:", "For the frosting:"), create a group for each with that name.
    - If not, put all ingredients into a single group. You can name this group "Ingredienser" (if Norwegian), "Ingredients" (if English), or "Ingredientes" (if Spanish), matching the input language if discernible. Or leave the group name empty if no distinct group is obvious from the source.
    - For each ingredient:
        - **name**: Extract *only* the actual name of the ingredient (e.g., 'mel', 'sukker', 'egg'). CRITICAL: The 'name' field must NOT include the quantity or unit, as those are parsed into separate 'quantity' and 'unit' fields. For example, if the source text for an ingredient line is '250 g hvetemel', the 'name' should be 'hvetemel', 'quantity' should be '250', and 'unit' should be 'g'. The numbers and units must be extracted to their respective fields and completely excluded from this 'name' field.
        - **quantity**: The quantity of the ingredient (e.g., "250", "1 1/4"), if specified.
        - **unit**: The unit for the quantity (e.g., "g", "ts", "stk"), if specified.
- **instructions**: A list of preparation steps. Each distinct step should be its own item, as written in the source.
- **tips**: Any additional tips, variations, or serving suggestions, if explicitly provided.
- **servingsValue**: The number of servings or pieces the recipe makes, if specified. If a range is given (e.g., "4-5 epler" potentially for 4-5 servings), try to pick a number or average if clearly implied for the yield.
- **servingsUnit**: The unit for the servings, either "servings" or "pieces", if specified. If the recipe specifies "stk" or items, use "pieces". Default to "servings" if ambiguous.
- **prepTime**: Preparation time, if specified.
- **cookTime**: Cooking time, if specified.
- **tags**: Comma-separated tags, if any are explicitly listed.
- **categories**: Comma-separated categories, if any are explicitly listed.
- **sourceUrl**: If the \`inputText\` provided above is a valid HTTP or HTTPS URL, set this field to that exact URL. Otherwise, this field should be omitted.
- **extractedImageUrl**: IMPORTANT: If the \`inputText\` is a URL, attempt to extract the URL of the primary image for the recipe from the fetched page content. Prioritize as follows:
    1.  The URL specified in an 'og:image' meta tag.
    2.  If no 'og:image' tag, look for the most prominent image directly associated with the recipe content.
    3.  Ensure the URL is a direct link to an image file (e.g., ending in .jpg, .png, .webp).
    If a relevant image URL is found, include it. Otherwise, omit this field.

Ensure the output strictly adheres to the JSON schema.
The language of the output fields (like ingredient group names if you generate them) should match the language of the input recipe if discernible and specified in the source (e.g., use "Ingredienser" for Norwegian recipes if that term is used or clearly implied for an unnamed group).

Example for a URL like 'https://www.godt.no/oppskrifter/kaker/kremkaker/8895/marengsrull-med-sitronkrem-og-bringebaer':
- sourceUrl should be 'https://www.godt.no/oppskrifter/kaker/kremkaker/8895/marengsrull-med-sitronkrem-og-bringebaer'.
- Title should be 'Marengsrull med sitronkrem og bringebær' (if that's on the page).
- Ingredients like "150 g eggehviter" should be: name: "eggehviter", quantity: "150", unit: "g".
- "3 dl sukker" should be: name: "sukker", quantity: "3", unit: "dl".
- "Saften av 1 stk sitron" should be name: "sitron", quantity: "1", unit: "stk saften av".
- extractedImageUrl: Try to find the main recipe image URL from this page.

For the 'Eplekake' text example:
- sourceUrl should be undefined or omitted.
- extractedImageUrl should be undefined or omitted.
- Title should be 'Eplekake'.
- Ingredients like '250 g smør' should be: name: 'smør', quantity: '250', unit: 'g'.
- '5 egg' should be name: 'egg', quantity: '5', unit: (empty or 'stk').
- '1 1/4 ts bakepulver' should be name: 'bakepulver', quantity: '1 1/4', unit: 'ts'.
- '4–5 epler (gjerne gule)' should be name: 'epler (gjerne gule)', quantity: '4-5', unit: (empty or 'stk').
- Instructions need to be split by step.
- If a round cake form of 24cm is mentioned, and yield is stated as '1 kake' or '10-12 porsjoner', extract that. Do not infer yield otherwise.

Output JSON:
`,
});


// Genkit Flow
const parseRecipeFlow = ai.defineFlow(
  {
    name: 'parseRecipeFlow',
    inputSchema: ParseRecipeInputSchema,
    outputSchema: ParsedRecipeOutputSchema,
  },
  async (input: ParseRecipeInput) => {
    try {
      const { output } = await recipeParserPrompt(input);
      if (!output) {
        throw new Error('AI did not return structured recipe data.');
      }
      // Basic validation that key fields are present
      if (!output.title || !output.ingredientGroups || !output.instructions) {
        throw new Error('AI output is missing essential recipe fields (title, ingredients, or instructions).');
      }
      return output;
    } catch (error) {
      console.error('[parseRecipeFlow] Error during recipe parsing:', error);
      // Re-throw to be caught by the calling UI component
      throw error;
    }
  }
);

