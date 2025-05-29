
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
      // Fetch user's own recipes (public or private)
      const myRecipesQuery = query(recipesCollectionRef, where("createdBy", "==", user.uid));
      const unsubscribeMy = onSnapshot(myRecipesQuery, (snapshot) => {
        const userRecipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setUserOwnedRecipes(userRecipesData);
      }, (error) => {
        console.error("[RecipeContext] Error fetching user's recipes:", error);
        setUserOwnedRecipes([]);
        setLoading(false); 
      });
      unsubscribes.push(unsubscribeMy);

      // Fetch public recipes NOT created by the user
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
      setPublicRecipesFromOthers([]); 
      const publicQuery = query(recipesCollectionRef, where("isPublic", "==", true));
      const unsubscribePublic = onSnapshot(publicQuery, (snapshot) => {
        const publicRecipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setPublicRecipesFromOthers(publicRecipesData); 
        setLoading(false); 
      }, (error) => {
        console.error("[RecipeContext] Error fetching all public recipes (logged out):", error);
        setPublicRecipesFromOthers([]);
        setLoading(false);
      });
      unsubscribes.push(unsubscribePublic);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, db]); 

  useEffect(() => {
    if (!db) {
      setLoading(false); 
      return;
    }

    if (user) {
      const combined = [...userOwnedRecipes];
      const userRecipeIds = new Set(userOwnedRecipes.map(r => r.id));
      
      publicRecipesFromOthers.forEach(publicRecipe => {
        if (!userRecipeIds.has(publicRecipe.id)) { 
          combined.push(publicRecipe);
        }
      });
      setRecipes(combined);
    } else {
      setRecipes(publicRecipesFromOthers);
    }
    
    // Determine loading state more accurately based on whether both user and public recipes have been processed
    if (user) {
      // For logged-in user, consider loading complete if both their recipes and public-others have been processed.
      // This logic might need refinement if one snapshot arrives much later than the other.
      // A simple approach is to set loading false once the combined list is formed.
      if (loading) setLoading(false);
    } else {
      // For logged-out user, loading is set false by the public recipes snapshot.
      // This effect might run before/after, so check loading state.
      if (loading) setLoading(false);
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

  const exportUserRecipes = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not logged in." };
    
    const userRecipesToExport = recipes.filter(recipe => recipe.createdBy === user.uid);
    if (userRecipesToExport.length === 0) {
      return { success: false, error: "No recipes to export." };
    }

    try {
      const jsonString = JSON.stringify(userRecipesToExport, null, 2);
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

