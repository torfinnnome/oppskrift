import type { Recipe } from "./recipe";

export interface DayMeal {
  dayIndex: number; // 0 = Monday, 6 = Sunday
  recipe: Recipe | null;
  locked: boolean;
}

export interface WeekPlan {
  meals: DayMeal[];
  pool: Recipe[]; // Remaining recipes not assigned to any day
}

export interface GeneratePlanResponse {
  preAssigned: { dayIndex: number; recipe: Recipe }[];
  pool: Recipe[];
}

export interface GeneratePlanRequest {
  locale?: string;
  categoryFilters?: string[];
  tagFilters?: string[];
}

export interface PlannerOptions {
  categories: string[];
  tags: string[];
}
