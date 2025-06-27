"use client";

import type { Recipe } from "@/types";
import React, { createContext, useContext, ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import useSWR, { useSWRConfig } from 'swr';
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";

interface RecipeContextType {
  recipes: Recipe[];
  addRecipe: (recipe: Omit<Recipe, "id" | "createdAt" | "updatedAt">) => Promise<Recipe>; 
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  getRecipeById: (recipeId: string) => Recipe | undefined;
  submitRecipeRating: (recipeId: string, rating: number) => Promise<void>;
  loading: boolean;
  exportUserRecipes: () => Promise<{ success: boolean; error?: string }>;
  importRecipes: (jsonString: string) => Promise<{ success: boolean; count: number; error?: string }>;
  exportUserRecipesAsHTML: () => Promise<{ success: boolean; content?: string; error?: string }>;
  exportUserRecipesAsMarkdown: () => Promise<{ success: boolean; content?: string; error?: string }>;
  exportSingleRecipeAsHTML: (recipeId: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  exportSingleRecipeAsMarkdown: (recipeId: string) => Promise<{ success: boolean; content?: string; error?: string }>;
}

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

const fetcher = (url: string) => fetch(url).then(res => res.json());

export const RecipeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { language } = useLanguage();

  const { data: recipes, error, isLoading } = useSWR<Recipe[]>("/api/recipes", fetcher);

  const addRecipe = async (recipeData: Omit<Recipe, "id" | "createdAt" | "updatedAt">): Promise<Recipe> => {
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipeData),
    });

    if (!response.ok) {
      throw new Error(t("failed_to_create_recipe"));
    }

    const newRecipe = await response.json();
    mutate("/api/recipes");
    return newRecipe;
  };

  const updateRecipe = async (updatedRecipe: Recipe): Promise<void> => {
    const response = await fetch(`/api/recipes/${updatedRecipe.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedRecipe),
    });

    if (!response.ok) {
      throw new Error(t("failed_to_update_recipe"));
    }

    mutate("/api/recipes");
  };

  const deleteRecipe = async (recipeId: string): Promise<void> => {
    const response = await fetch(`/api/recipes/${recipeId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(t("failed_to_delete_recipe"));
    }

    mutate("/api/recipes");
  };

  const getRecipeById = (recipeId: string): Recipe | undefined => {
    return recipes?.find((r) => r.id === recipeId);
  };

  const submitRecipeRating = async (recipeId: string, userId: string, rating: number): Promise<void> => {
    const response = await fetch(`/api/recipes/${recipeId}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, rating }),
    });

    if (!response.ok) {
      throw new Error(t("failed_to_submit_rating"));
    }

    // Revalidate recipes data after rating submission
    mutate("/api/recipes");
    mutate(`/api/recipes/${recipeId}`);
  };

  const exportUserRecipes = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/recipes/export");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("failed_to_export_recipes"));
      }
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recipes-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (error: any) {
      console.error("Error exporting recipes:", error);
      return { success: false, error: error.message };
    }
  };

  const importRecipes = async (jsonString: string): Promise<{ success: boolean; count: number; error?: string; skippedCount?: number }> => {
    try {
      const recipesToImport = JSON.parse(jsonString);
      if (!Array.isArray(recipesToImport)) {
        throw new Error(t("invalid_json_file_format"));
      }

      const response = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipesToImport),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("failed_to_import_recipes"));
      }

      const result = await response.json();
      mutate("/api/recipes"); // Revalidate recipes after import
      return { success: true, count: result.count, skippedCount: result.skippedCount };
    } catch (error: any) {
      console.error("Error importing recipes:", error);
      return { success: false, count: 0, error: error.message };
    }
  };

  const exportUserRecipesAsHTML = async (): Promise<{ success: boolean; content?: string; error?: string }> => {
    try {
      const lang = language || 'en'; // Fallback to 'en'
      const response = await fetch(`/api/recipes/export?format=html&lang=${lang}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("failed_to_export_recipes"));
      }
      const content = await response.text();
      return { success: true, content };
    } catch (error: any) {
      console.error("Error exporting recipes as HTML:", error);
      return { success: false, error: error.message };
    }
  };

  const exportUserRecipesAsMarkdown = async (): Promise<{ success: boolean; content?: string; error?: string }> => {
    try {
      const lang = language || 'en'; // Fallback to 'en'
      const response = await fetch(`/api/recipes/export?format=markdown&lang=${lang}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("failed_to_export_recipes"));
      }
      const content = await response.text();
      return { success: true, content };
    } catch (error: any) {
      console.error("Error exporting recipes as Markdown:", error);
      return { success: false, error: error.message };
    }
  };

  const exportSingleRecipeAsHTML = async (recipeId: string): Promise<{ success: boolean; content?: string; error?: string }> => {
    try {
      const lang = language || 'en'; // Fallback to 'en'
      const response = await fetch(`/api/recipes/export?id=${recipeId}&format=html&lang=${lang}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("failed_to_export_recipe"));
      }
      const content = await response.text();
      return { success: true, content };
    } catch (error: any) {
      console.error("Error exporting single recipe as HTML:", error);
      return { success: false, error: error.message };
    }
  };

  const exportSingleRecipeAsMarkdown = async (recipeId: string): Promise<{ success: boolean; content?: string; error?: string }> => {
    try {
      const lang = language || 'en'; // Fallback to 'en'
      const response = await fetch(`/api/recipes/export?id=${recipeId}&format=markdown&lang=${lang}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t("failed_to_export_recipe"));
      }
      const content = await response.text();
      return { success: true, content };
    } catch (error: any) {
      console.error("Error exporting single recipe as Markdown:", error);
      return { success: false, error: error.message };
    }
  };

  return (
    <RecipeContext.Provider value={{ recipes: recipes || [], addRecipe, updateRecipe, deleteRecipe, getRecipeById, submitRecipeRating, loading: isLoading, exportUserRecipes, importRecipes, exportUserRecipesAsHTML, exportUserRecipesAsMarkdown, exportSingleRecipeAsHTML, exportSingleRecipeAsMarkdown }}>
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipes = (): RecipeContextType => {
  const context = useContext(RecipeContext);
  if (context === undefined) throw new Error("useRecipes must be used within a RecipeProvider");
  return context;
};