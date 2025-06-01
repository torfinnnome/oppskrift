
"use client";

import type { Recipe, Ingredient } from "@/types";
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/firebase"; 
import { useAuth } from "./AuthContext"; 
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
  getDocs,
  Timestamp, 
} from "firebase/firestore";

interface RecipeContextType {
  recipes: Recipe[];
  addRecipe: (recipe: Omit<Recipe, "id" | "createdAt" | "updatedAt">) => Promise<Recipe>; 
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  getRecipeById: (recipeId: string) => Recipe | undefined;
  loading: boolean;
  exportUserRecipes: () => Promise<{ success: boolean; error?: string }>;
  importRecipes: (jsonString: string) => Promise<{ success: boolean; count: number; error?: string }>;
  exportUserRecipesAsHTML: () => Promise<{ success: boolean; error?: string }>;
  exportUserRecipesAsMarkdown: () => Promise<{ success: boolean; error?: string }>;
  exportSingleRecipeAsHTML: (recipeId: string) => Promise<{ success: boolean; error?: string, filename?: string }>;
  exportSingleRecipeAsMarkdown: (recipeId: string) => Promise<{ success: boolean; error?: string, filename?: string }>;
}

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

const ensureIngredientIds = (ingredients: Partial<Ingredient>[]): Ingredient[] => {
  return ingredients.map(ing => ({
    id: ing.id || uuidv4(),
    name: ing.name || '',
    quantity: ing.quantity || '', 
    unit: ing.unit || ''
  })) as Ingredient[];
};

const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

const formatRecipeToHTML = (recipe: Recipe): string => {
  let html = `<div class="recipe" style="margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #ccc;">`;
  html += `<h1 style="color: #333; margin-bottom: 5px;">${recipe.title}</h1>`;
  if (recipe.description) {
    html += `<p style="font-style: italic; color: #555; margin-top: 0;">${recipe.description}</p>`;
  }
  html += `<div class="meta" style="font-size: 0.9em; color: #777; margin-bottom: 15px;">`;
  if (recipe.servings) html += `<span style="margin-right: 15px;"><strong>Servings:</strong> ${recipe.servings}</span>`;
  if (recipe.prepTime) html += `<span style="margin-right: 15px;"><strong>Prep Time:</strong> ${recipe.prepTime}</span>`;
  if (recipe.cookTime) html += `<span><strong>Cook Time:</strong> ${recipe.cookTime}</span>`;
  html += `</div>`;

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">Ingredients</h2>`;
    html += `<ul style="margin-left: 20px; padding-left: 0; list-style-position: inside;">`;
    recipe.ingredients.forEach(ing => {
      html += `<li style="margin-bottom: 5px;">${ing.quantity || ''} ${ing.unit || ''} ${ing.name}</li>`;
    });
    html += `</ul>`;
  }

  if (recipe.instructions) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">Instructions</h2>`;
    html += `<div style="white-space: pre-wrap;">${recipe.instructions.replace(/\n/g, '<br>')}</div>`;
  }

  if (recipe.categories && recipe.categories.length > 0) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">Categories</h2>`;
    html += `<p>${recipe.categories.join(", ")}</p>`;
  }
  if (recipe.tags && recipe.tags.length > 0) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">Tags</h2>`;
    html += `<p>${recipe.tags.join(", ")}</p>`;
  }
  html += `</div>`;
  return html;
};

const formatRecipeToMarkdown = (recipe: Recipe): string => {
  let md = `# ${recipe.title}\n\n`;
  if (recipe.description) {
    md += `_${recipe.description}_\n\n`;
  }
  if (recipe.servings) md += `**Servings:** ${recipe.servings}\n`;
  if (recipe.prepTime) md += `**Prep Time:** ${recipe.prepTime}\n`;
  if (recipe.cookTime) md += `**Cook Time:** ${recipe.cookTime}\n\n`;

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    md += `## Ingredients\n\n`;
    recipe.ingredients.forEach(ing => {
      md += `- ${ing.quantity || ''} ${ing.unit || ''} ${ing.name}\n`;
    });
    md += `\n`;
  }

  if (recipe.instructions) {
    md += `## Instructions\n\n${recipe.instructions}\n\n`;
  }

  if (recipe.categories && recipe.categories.length > 0) {
    md += `## Categories\n\n- ${recipe.categories.join("\n- ")}\n\n`;
  }
  if (recipe.tags && recipe.tags.length > 0) {
    md += `## Tags\n\n- ${recipe.tags.join("\n- ")}\n\n`;
  }
  return md;
};


export const RecipeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [userOwnedRecipes, setUserOwnedRecipes] = useState<Recipe[]>([]);
  const [publicRecipesFromOthers, setPublicRecipesFromOthers] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); 

  useEffect(() => {
    if (!db) {
      setRecipes([]);
      setUserOwnedRecipes([]);
      setPublicRecipesFromOthers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const recipesCollectionRef = collection(db, "recipes");
    const unsubscribes: (() => void)[] = [];

    if (user) {
      const myRecipesQuery = query(recipesCollectionRef, where("createdBy", "==", user.uid));
      const unsubscribeMy = onSnapshot(myRecipesQuery, (snapshot) => {
        const userRecipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setUserOwnedRecipes(userRecipesData);
      }, (error) => {
        console.error("[RecipeContext] Error fetching user's recipes:", error);
        setUserOwnedRecipes([]);
         if (loading) setLoading(false);
      });
      unsubscribes.push(unsubscribeMy);

      const publicOthersQuery = query(
        recipesCollectionRef,
        where("isPublic", "==", true),
        where("createdBy", "!=", user.uid)
      );
      const unsubscribePublicOthers = onSnapshot(publicOthersQuery, (snapshot) => {
        const publicRecipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setPublicRecipesFromOthers(publicRecipesData);
      }, (error) => {
        console.error("[RecipeContext] Error fetching public recipes from others:", error);
        setPublicRecipesFromOthers([]);
      });
      unsubscribes.push(unsubscribePublicOthers);

    } else { 
      setUserOwnedRecipes([]); 
      const publicQuery = query(recipesCollectionRef, where("isPublic", "==", true));
      const unsubscribePublic = onSnapshot(publicQuery, (snapshot) => {
        const publicRecipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setPublicRecipesFromOthers(publicRecipesData); 
        if (loading) setLoading(false);
      }, (error) => {
        console.error("[RecipeContext] Error fetching all public recipes (logged out):", error);
        setPublicRecipesFromOthers([]);
        if (loading) setLoading(false);
      });
      unsubscribes.push(unsubscribePublic);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, db]); 

  useEffect(() => {
     if (!db) {
      if (loading) setLoading(false);
      return;
    }
    let combinedRecipes: Recipe[] = [];
    if (user) {
      const tempCombined = [...userOwnedRecipes];
      const userRecipeIds = new Set(userOwnedRecipes.map(r => r.id));
      publicRecipesFromOthers.forEach(publicRecipe => {
        if (!userRecipeIds.has(publicRecipe.id)) {
          tempCombined.push(publicRecipe);
        }
      });
      combinedRecipes = tempCombined;
    } else {
      combinedRecipes = [...publicRecipesFromOthers];
    }
    setRecipes(combinedRecipes);

    if (loading) { // Only set loading to false if it was true
        // A more robust loading check would involve tracking if initial loads for all relevant queries have completed.
        // For now, if user exists, loading primarily depends on userOwnedRecipes and publicRecipesFromOthers.
        // If user doesn't exist, it depends on publicRecipesFromOthers.
        // This simplified check sets loading to false once recipes are combined.
        setLoading(false);
    }
  }, [userOwnedRecipes, publicRecipesFromOthers, user, db, loading]);

  const addRecipe = async (recipeData: Omit<Recipe, "id" | "createdAt" | "updatedAt">): Promise<Recipe> => {
    if (!user || !db) throw new Error("User not authenticated or Firestore not initialized.");
    
    const newRecipeData = {
      ...recipeData,
      ingredients: ensureIngredientIds(recipeData.ingredients || []),
      isPublic: recipeData.isPublic || false,
      createdBy: user.uid, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "recipes"), newRecipeData);
    return { ...newRecipeData, id: docRef.id }; 
  };

  const updateRecipe = async (updatedRecipe: Recipe): Promise<void> => {
    if (!user || !db) throw new Error("User not authenticated or Firestore not initialized.");

    const recipeDocRef = doc(db, "recipes", updatedRecipe.id);
    const recipePayload = {
      ...updatedRecipe,
      ingredients: ensureIngredientIds(updatedRecipe.ingredients || []),
      isPublic: updatedRecipe.isPublic || false,
      updatedAt: new Date().toISOString(),
    };
    
    const { id, ...payload } = recipePayload; 
    await updateDoc(recipeDocRef, payload);
  };

  const deleteRecipe = async (recipeId: string): Promise<void> => {
     if (!user || !db) throw new Error("User not authenticated or Firestore not initialized.");
    await deleteDoc(doc(db, "recipes", recipeId));
  };

  const getRecipeById = (recipeId: string): Recipe | undefined => {
    return recipes.find((recipe) => recipe.id === recipeId);
  };

  const triggerDownload = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportUserRecipesAsHTML = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not logged in." };
    const userRecipesToExport = recipes.filter(recipe => recipe.createdBy === user.uid);
    if (userRecipesToExport.length === 0) return { success: false, error: "No recipes to export." };

    try {
      let allRecipesHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My Oppskrift Recipes</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; line-height: 1.6; margin: 20px; color: #333; background-color: #fdfdfd; }
    .recipe { margin-bottom: 40px; padding: 20px; border: 1px solid #eee; border-radius: 8px; background-color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    h1 { color: #d66800; margin-bottom: 10px; font-size: 1.8em; }
    h2 { color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px; font-size: 1.4em; }
    ul, ol { margin-left: 20px; padding-left: 0; }
    li { margin-bottom: 6px; }
    strong { font-weight: 600; }
    .meta { font-size: 0.9em; color: #666; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
    .meta span { margin-right: 15px; }
    .instructions-text { white-space: pre-wrap; }
    .categories-tags p { margin-top: 5px; }
  </style>
</head>
<body>`;
      userRecipesToExport.forEach(recipe => {
        allRecipesHTML += formatRecipeToHTML(recipe);
      });
      allRecipesHTML += `</body></html>`;
      const date = new Date().toISOString().split('T')[0];
      triggerDownload(allRecipesHTML, `oppskrift_recipes_export_${date}.html`, "text/html");
      return { success: true };
    } catch (e: any) {
      console.error("Error exporting recipes as HTML:", e);
      return { success: false, error: e.message || "Failed to export recipes as HTML." };
    }
  };

  const exportUserRecipesAsMarkdown = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not logged in." };
    const userRecipesToExport = recipes.filter(recipe => recipe.createdBy === user.uid);
    if (userRecipesToExport.length === 0) return { success: false, error: "No recipes to export." };

    try {
      const allRecipesMD = userRecipesToExport.map(recipe => formatRecipeToMarkdown(recipe)).join("\n\n---\n\n");
      const date = new Date().toISOString().split('T')[0];
      triggerDownload(allRecipesMD, `oppskrift_recipes_export_${date}.md`, "text/markdown");
      return { success: true };
    } catch (e: any) {
      console.error("Error exporting recipes as Markdown:", e);
      return { success: false, error: e.message || "Failed to export recipes as Markdown." };
    }
  };
  
  const exportSingleRecipeAsHTML = async (recipeId: string): Promise<{ success: boolean; error?: string, filename?: string }> => {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, error: "Recipe not found." };
    try {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recipe: ${recipe.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; line-height: 1.6; margin: 20px; color: #333; background-color: #fdfdfd; }
    .recipe { margin-bottom: 40px; padding: 20px; border: 1px solid #eee; border-radius: 8px; background-color: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    h1 { color: #d66800; margin-bottom: 10px; font-size: 1.8em; }
    h2 { color: #333; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-top: 25px; margin-bottom: 15px; font-size: 1.4em; }
    ul, ol { margin-left: 20px; padding-left: 0; }
    li { margin-bottom: 6px; }
    strong { font-weight: 600; }
    .meta { font-size: 0.9em; color: #666; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
    .meta span { margin-right: 15px; }
    .instructions-text { white-space: pre-wrap; }
    .categories-tags p { margin-top: 5px; }
  </style>
</head>
<body>${formatRecipeToHTML(recipe)}</body></html>`;
      const filename = `oppskrift_${slugify(recipe.title)}.html`;
      triggerDownload(htmlContent, filename, "text/html");
      return { success: true, filename };
    } catch (e: any) {
      console.error("Error exporting single recipe as HTML:", e);
      return { success: false, error: e.message || "Failed to export recipe as HTML." };
    }
  };

  const exportSingleRecipeAsMarkdown = async (recipeId: string): Promise<{ success: boolean; error?: string, filename?: string }> => {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return { success: false, error: "Recipe not found." };
    try {
      const mdContent = formatRecipeToMarkdown(recipe);
      const filename = `oppskrift_${slugify(recipe.title)}.md`;
      triggerDownload(mdContent, filename, "text/markdown");
      return { success: true, filename };
    } catch (e: any) {
      console.error("Error exporting single recipe as Markdown:", e);
      return { success: false, error: e.message || "Failed to export recipe as Markdown." };
    }
  };


  const exportUserRecipes = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not logged in." };
    
    const userRecipesToExport = recipes.filter(recipe => recipe.createdBy === user.uid);
    if (userRecipesToExport.length === 0) {
      return { success: false, error: "No recipes to export." };
    }

    try {
      const jsonString = JSON.stringify(userRecipesToExport, null, 2);
      const date = new Date().toISOString().split('T')[0];
      triggerDownload(jsonString, `oppskrift_recipes_export_${date}.json`, "application/json");
      return { success: true };
    } catch (e: any) {
      console.error("Error exporting recipes:", e);
      return { success: false, error: e.message || "Failed to export recipes." };
    }
  };

  const importRecipes = async (jsonString: string): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!user) return { success: false, count: 0, error: "User not logged in." };

    try {
      const importedRecipeObjects = JSON.parse(jsonString);
      if (!Array.isArray(importedRecipeObjects)) {
        return { success: false, count: 0, error: "Invalid JSON file format: not an array." };
      }

      let importedCount = 0;
      for (const recipeObj of importedRecipeObjects) {
        if (!recipeObj.title || !recipeObj.instructions || !Array.isArray(recipeObj.ingredients)) {
          console.warn("Skipping invalid recipe object during import:", recipeObj);
          continue;
        }

        const recipeToImport: Omit<Recipe, "id" | "createdAt" | "updatedAt"> = {
          title: recipeObj.title,
          description: recipeObj.description || "",
          ingredients: ensureIngredientIds(recipeObj.ingredients || []),
          instructions: recipeObj.instructions,
          tags: Array.isArray(recipeObj.tags) ? recipeObj.tags.map(String) : [],
          categories: Array.isArray(recipeObj.categories) ? recipeObj.categories.map(String) : [],
          servings: typeof recipeObj.servings === 'number' ? recipeObj.servings : 1,
          prepTime: recipeObj.prepTime || "",
          cookTime: recipeObj.cookTime || "",
          imageUrl: recipeObj.imageUrl || "",
          isPublic: recipeObj.isPublic === true, 
          createdBy: user.uid, 
        };
        await addRecipe(recipeToImport); 
        importedCount++;
      }
      return { success: true, count: importedCount };
    } catch (e: any) {
      console.error("Error importing recipes:", e);
      return { success: false, count: 0, error: e.message || "Failed to import recipes. Invalid JSON content." };
    }
  };
  
  return (
    <RecipeContext.Provider value={{ 
        recipes, 
        addRecipe, 
        updateRecipe, 
        deleteRecipe, 
        getRecipeById, 
        loading, 
        exportUserRecipes, 
        importRecipes,
        exportUserRecipesAsHTML,
        exportUserRecipesAsMarkdown,
        exportSingleRecipeAsHTML,
        exportSingleRecipeAsMarkdown
      }}>
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipes = (): RecipeContextType => {
  const context = useContext(RecipeContext);
  if (context === undefined) {
    throw new Error("useRecipes must be used within a RecipeProvider");
  }
  return context;
};

