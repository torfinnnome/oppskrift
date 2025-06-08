
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
  title: z.string().describe("The title of the recipe. Extract this as accurately as possible."),
  description: z.string().optional().describe("A brief description or introduction to the recipe, if present."),
  ingredientGroups: z.array(
    z.object({
      name: z.string().optional().describe("The name of this ingredient group (e.g., 'For the dough', 'For the filling'). If the source text does not explicitly name groups, you can create a single group named 'Ingredients' or leave this empty."),
      ingredients: z.array(
        z.object({
          name: z.string().describe("The name of the ingredient (e.g., 'flour', 'sugar', 'eggs')."),
          quantity: z.string().optional().describe("The quantity of the ingredient (e.g., '250', '1 1/4', 'a pinch'). Include numeric values and fractions if present."),
          unit: z.string().optional().describe("The unit for the quantity (e.g., 'g', 'ts', 'ml', 'stk').")
        })
      ).describe("The list of ingredients in this group. Each ingredient should be an object with name, quantity, and unit.")
    })
  ).describe("An array of ingredient groups. If the recipe is simple and has no explicit groups, put all ingredients into one group. The group name can be omitted or set to something generic like 'Ingredients'."),
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
  sourceUrl: z.string().optional().describe("If the `inputText` appears to be a valid HTTP/HTTPS URL, this field should contain that exact URL. Otherwise, this field should be omitted or undefined."),
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
  prompt: `You are an expert recipe parsing assistant. Your task is to analyze the provided input, which can be either raw recipe text or a URL pointing to a recipe, and structure it into a JSON object matching the provided schema.

Input text:
\`\`\`
{{{inputText}}}
\`\`\`

Carefully extract the following information:
- **title**: The main title of the recipe.
- **description**: Any introductory text or summary.
- **ingredientGroups**:
    - If the recipe has named sections for ingredients (e.g., "For the cake:", "For the frosting:"), create a group for each with that name.
    - If not, put all ingredients into a single group. You can name this group "Ingredienser" (if Norwegian), "Ingredients" (if English), or "Ingredientes" (if Spanish), matching the input language. Or leave the group name empty if no distinct group is obvious.
    - For each ingredient, try to separate its name, quantity (e.g., "250", "1 1/4"), and unit (e.g., "g", "ts", "stk"). If quantity or unit is not specified, omit it.
- **instructions**: A list of preparation steps. Each distinct step should be its own item.
- **tips**: Any additional tips, variations, or serving suggestions.
- **servingsValue**: The number of servings or pieces the recipe makes. If a range is given (e.g., "4-5 epler" potentially for 4-5 servings), try to pick a number or average.
- **servingsUnit**: The unit for the servings, either "servings" or "pieces". If the recipe specifies "stk" or items, use "pieces". Default to "servings" if ambiguous. For example, 'Kaken serveres varm med iskrem til. Men det går selvfølgelig også an å servere den med pisket krem.' for a 'rund springform med en diameter på 24 cm' often implies 8-12 servings. If it yields '1 kake', use 'pieces' and '1' as value.
- **prepTime**: Preparation time.
- **cookTime**: Cooking time.
- **tags**: Comma-separated tags, if any are apparent.
- **categories**: Comma-separated categories, if any are apparent.
- **sourceUrl**: If the \`inputText\` provided above is a valid HTTP or HTTPS URL (e.g., starts with "http://" or "https://"), then set this field to that exact URL. Otherwise, this field should be omitted or left undefined in the JSON output.

If the input is a URL, attempt to fetch and parse its content as if it were recipe text.
Prioritize accuracy and structure. If some information is not available in the source, omit the corresponding optional fields in the output.
Ensure the output strictly adheres to the JSON schema provided for the output.
The language of the output fields (like ingredient group names if you generate them) should match the language of the input recipe if discernible (e.g., use "Ingredienser" for Norwegian recipes).

Example for a URL like 'https://www.godt.no/oppskrifter/kaker/kremkaker/8895/marengsrull-med-sitronkrem-og-bringebaer':
- sourceUrl should be 'https://www.godt.no/oppskrifter/kaker/kremkaker/8895/marengsrull-med-sitronkrem-og-bringebaer'.
- Title should be 'Marengsrull med sitronkrem og bringebær'.
- Ingredients like "150 g eggehviter" should be: name: "eggehviter", quantity: "150", unit: "g".
- "3 dl sukker" should be: name: "sukker", quantity: "3", unit: "dl".
- "Saften av 1 stk sitron" should be name: "sitron", quantity: "1", unit: "stk saften av".

For the 'Eplekake' text example:
- sourceUrl should be undefined or omitted.
- Title should be 'Eplekake'.
- Ingredients like '250 g smør' should be: name: 'smør', quantity: '250', unit: 'g'.
- '5 egg' should be name: 'egg', quantity: '5', unit: (empty or 'stk').
- '1 1/4 ts bakepulver' should be name: 'bakepulver', quantity: '1 1/4', unit: 'ts'.
- '4–5 epler (gjerne gule)' should be name: 'epler (gjerne gule)', quantity: '4-5', unit: (empty or 'stk').
- Instructions need to be split by step.
- If a round cake form of 24cm is mentioned, you could infer servingsValue: 10 and servingsUnit: 'servings'.

Focus on correctly parsing quantities and units. For example, "4–5 epler" means "epler" (apples), quantity "4-5". "2 ts kanel" means "kanel" (cinnamon), quantity "2", unit "ts".

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

