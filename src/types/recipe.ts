
export interface Ingredient {
  id: string;
  name: string;
  quantity: string; // Keep as string to allow "1/2", "a pinch", etc. Could be number for stricter scaling.
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string;
  tags: string[];
  categories: string[];
  servings: number;
  prepTime?: string; // e.g., "30 minutes"
  cookTime?: string; // e.g., "1 hour"
  imageUrl?: string; // URL or base64 data URI
  isPublic?: boolean; // New field, defaults to false (private)
  createdBy?: string; // User ID
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}
