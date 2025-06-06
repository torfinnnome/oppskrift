
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

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredientGroups: IngredientGroup[];
  instructions: InstructionStep[];
  tips?: TipStep[];
  tags: string[];
  categories: string[];
  servingsValue: number; // Changed from servings
  servingsUnit: ServingsUnit; // New field
  prepTime?: string; // e.g., "30 minutes"
  cookTime?: string; // e.g., "1 hour"
  imageUrl?: string; // URL or base64 data URI
  isPublic?: boolean;
  createdBy?: string; // User ID
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

