export interface Ingredient {
  id: string; // Persistent ID
  fieldId?: string; // Temporary ID for react-hook-form's useFieldArray key
  name: string;
  quantity: string;
  unit: string;
}

export interface IngredientGroup {
  id: string; // Persistent ID
  fieldId?: string; // Temporary ID for react-hook-form's useFieldArray key
  name: string;
  ingredients: Ingredient[];
}

export interface InstructionStep {
  id: string; // Persistent ID
  fieldId?: string; // Temporary ID for react-hook-form's useFieldArray key
  text: string;
  isChecked: boolean; // For client-side interaction, not persisted
}

export interface TipStep {
  id: string; // Persistent ID
  fieldId?: string; // Temporary ID for react-hook-form's useFieldArray key
  text: string;
  isChecked: boolean; // For client-side interaction, not persisted
}

export type ServingsUnit = 'servings' | 'pieces';

export interface Rating {
  id: string;
  userId: string;
  recipeId: string;
  value: number;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredientGroups: IngredientGroup[];
  instructions: InstructionStep[];
  tips?: TipStep[];
  tags: { name: string }[];
  categories: { name: string }[];
  servingsValue: number;
  servingsUnit: ServingsUnit;
  prepTime?: string;
  cookTime?: string;
  imageUrl?: string;
  sourceUrl?: string; // Added source URL
  isPublic?: boolean;
  createdBy?: string; // User ID
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  ratings?: Rating[]; // Updated to reflect API response as an array of Rating objects
  averageRating?: number; // Calculated average rating
  numRatings?: number; // Total number of ratings
}
