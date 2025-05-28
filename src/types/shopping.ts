export interface ShoppingListItem {
  id: string; // Unique ID for the shopping list item itself
  recipeId?: string; // Optional: ID of the recipe it came from
  recipeTitle?: string; // Optional: Title of the recipe
  name: string;
  quantity: string;
  unit: string;
  isChecked: boolean; // For users to mark as acquired
}
