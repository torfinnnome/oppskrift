
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
  Timestamp, // Import Timestamp
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
}

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

const ensureIngredientIds = (ingredients: Partial<Ingredient>[]): Ingredient[] => {
  return ingredients.map(ing => ({
    id: ing.id || uuidv4(),
    name: ing.name || '',
    quantity: ing.quantity || '', // Keep as string
    unit: ing.unit || ''
  })) as Ingredient[];
};

export const RecipeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [userOwnedRecipes, setUserOwnedRecipes] = useState<Recipe[]>([]);
  const [publicRecipes, setPublicRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); 

  useEffect(() => {
    setLoading(true);
    const recipesCollectionRef = collection(db, "recipes");
    const unsubscribes: (() => void)[] = [];

    if (user && db) {
      const myRecipesQuery = query(recipesCollectionRef, where("createdBy", "==", user.uid));
      const unsubscribeMy = onSnapshot(myRecipesQuery, (snapshot) => {
        const userRecipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setUserOwnedRecipes(userRecipesData);
      }, (error) => {
        console.error("Error fetching user's recipes:", error);
        setUserOwnedRecipes([]);
      });
      unsubscribes.push(unsubscribeMy);

      const publicRecipesQuery = query(recipesCollectionRef, where("isPublic", "==", true), where("createdBy", "!=", user.uid));
      const unsubscribePublic = onSnapshot(publicRecipesQuery, (snapshot) => {
        const publicRecipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setPublicRecipes(publicRecipesData);
      }, (error) => {
        console.error("Error fetching public recipes (excluding own):", error);
        // If this query fails due to missing index, publicRecipes will be empty. User still sees their own.
        // Firestore usually provides a link in the console error to create the required composite index.
        setPublicRecipes([]); 
      });
      unsubscribes.push(unsubscribePublic);

    } else if (db) {
      setUserOwnedRecipes([]);
      const publicRecipesQuery = query(recipesCollectionRef, where("isPublic", "==", true));
      const unsubscribePublic = onSnapshot(publicRecipesQuery, (snapshot) => {
        const recipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setPublicRecipes(recipesData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching public recipes (logged out):", error);
        setPublicRecipes([]);
        setLoading(false);
      });
      unsubscribes.push(unsubscribePublic);
    } else {
      setRecipes([]);
      setUserOwnedRecipes([]);
      setPublicRecipes([]);
      setLoading(false);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  useEffect(() => {
    if (!db) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    
    if (user) {
      const combined = [...userOwnedRecipes];
      const userRecipeIds = new Set(userOwnedRecipes.map(r => r.id));
      
      publicRecipes.forEach(publicRecipe => {
        if (!userRecipeIds.has(publicRecipe.id)) {
          combined.push(publicRecipe);
        }
      });
      setRecipes(combined);
    } else {
      setRecipes(publicRecipes);
    }
    setLoading(false);
  }, [userOwnedRecipes, publicRecipes, user, db]);

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
    if (updatedRecipe.createdBy !== user.uid) throw new Error("User not authorized to update this recipe.");

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

  const exportUserRecipes = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not logged in." };
    
    const userRecipes = recipes.filter(recipe => recipe.createdBy === user.uid);
    if (userRecipes.length === 0) {
      return { success: false, error: "No recipes to export." };
    }

    try {
      const jsonString = JSON.stringify(userRecipes, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `oppskrift_recipes_export_${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
        // Basic validation - could be expanded with Zod
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
          isPublic: recipeObj.isPublic === true, // Ensure boolean
          createdBy: user.uid, // Assign to current user
        };
        await addRecipe(recipeToImport); // addRecipe handles new timestamps and Firestore ID
        importedCount++;
      }
      return { success: true, count: importedCount };
    } catch (e: any) {
      console.error("Error importing recipes:", e);
      return { success: false, count: 0, error: e.message || "Failed to import recipes. Invalid JSON content." };
    }
  };

  return (
    <RecipeContext.Provider value={{ recipes, addRecipe, updateRecipe, deleteRecipe, getRecipeById, loading, exportUserRecipes, importRecipes }}>
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

