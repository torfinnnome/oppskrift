
"use client";

import type { Recipe, Ingredient, IngredientGroup, InstructionStep, TipStep, ServingsUnit } from "@/types";
import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/firebase"; 
import { useAuth } from "./AuthContext"; 
import { useTranslation } from "@/lib/i18n";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query, 
  where,
  or,
  getDoc,
  Timestamp, 
} from "firebase/firestore";

interface RecipeContextType {
  recipes: Recipe[];
  addRecipe: (recipe: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "ratings" | "averageRating" | "numRatings">) => Promise<Recipe>; 
  updateRecipe: (recipe: Recipe) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  getRecipeById: (recipeId: string) => Recipe | undefined;
  submitRecipeRating: (recipeId: string, userId: string, rating: number) => Promise<void>;
  loading: boolean;
  exportUserRecipes: () => Promise<{ success: boolean; error?: string }>;
  importRecipes: (jsonString: string) => Promise<{ success: boolean; count: number; error?: string }>;
  exportUserRecipesAsHTML: () => Promise<{ success: boolean; error?: string }>;
  exportUserRecipesAsMarkdown: () => Promise<{ success: boolean; error?: string }>;
  exportSingleRecipeAsHTML: (recipeId: string, currentScaledServings?: number) => Promise<{ success: boolean; error?: string }>;
  exportSingleRecipeAsMarkdown: (recipeId: string, currentScaledServings?: number) => Promise<{ success: boolean; error?: string }>;
}

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

const scaleIngredientQuantity = (quantityStr: string, originalServingsValue: number, newServingsValue: number): string => {
  if (typeof quantityStr !== 'string') return '';
  const quantityNum = parseFloat(quantityStr.replace(',', '.'));
  if (isNaN(quantityNum) || originalServingsValue <= 0 || newServingsValue <= 0) return quantityStr;
  const scaledQuantity = (quantityNum / originalServingsValue) * newServingsValue;
  let formattedQuantity = Number.isInteger(scaledQuantity) ? scaledQuantity.toString() : Number(scaledQuantity.toFixed(2)).toString().replace(/\.?0+$/, '');
  return formattedQuantity.replace('.', ',');
};

const ensureIngredientStructure = (ingredients: Partial<Ingredient>[]): Ingredient[] => {
  return ingredients.map(ing => ({
    id: ing.id || uuidv4(),
    fieldId: ing.fieldId || uuidv4(),
    name: ing.name || '',
    quantity: ing.quantity || '', 
    unit: ing.unit || ''
  })) as Ingredient[];
};

const ensureIngredientGroupStructure = (groups: Partial<IngredientGroup>[], t: (key: string) => string): IngredientGroup[] => {
  if (!groups || groups.length === 0) {
    return [{
      id: uuidv4(),
      fieldId: uuidv4(),
      name: t('default_ingredient_group_name'),
      ingredients: []
    }];
  }
  return groups.map(group => ({
    id: group.id || uuidv4(),
    fieldId: group.fieldId || uuidv4(),
    name: group.name || "", 
    ingredients: ensureIngredientStructure(group.ingredients || [])
  })) as IngredientGroup[];
};

const ensureInstructionStepsStructure = (stepsData: any): InstructionStep[] => {
  if (typeof stepsData === 'string') { 
    return stepsData.split('\n').filter(line => line.trim() !== '').map(line => ({
      id: uuidv4(),
      fieldId: uuidv4(),
      text: line,
      isChecked: false,
    }));
  }
  if (Array.isArray(stepsData)) {
    return stepsData.map((step: any) => ({
      id: step.id || uuidv4(),
      fieldId: step.fieldId || uuidv4(),
      text: step.text || '',
      isChecked: step.isChecked || false, 
    }));
  }
  return [{ id: uuidv4(), fieldId: uuidv4(), text: '', isChecked: false }]; 
};

const ensureTipStepsStructure = (stepsData: any): TipStep[] => {
  if (typeof stepsData === 'string') {
    return stepsData.split('\n').filter(line => line.trim() !== '').map(line => ({
      id: uuidv4(),
      fieldId: uuidv4(),
      text: line,
      isChecked: false, 
    }));
  }
  if (Array.isArray(stepsData)) {
    return stepsData.map((step: any) => ({
      id: step.id || uuidv4(),
      fieldId: step.fieldId || uuidv4(),
      text: step.text || '',
      isChecked: step.isChecked || false,
    }));
  }
  return []; 
};


const formatRecipeToHTML = (recipe: Recipe, t: (key: string, params?:any) => string, forSingleView: boolean = false): string => {
  const servingsUnitText = recipe.servingsUnit === 'pieces' ? t('servings_unit_pieces') : t('servings_unit_servings');
  let html = `<div class="recipe" style="margin-bottom: 40px; padding-bottom: 20px; ${forSingleView ? '' : 'border-bottom: 2px solid #ccc;'}">`;
  html += `<h1 style="color: #333; margin-bottom: 5px;">${recipe.title}</h1>`;
  if (recipe.description) {
    html += `<p style="font-style: italic; color: #555; margin-top: 0;">${recipe.description}</p>`;
  }
  if (recipe.sourceUrl) {
    html += `<p style="font-size: 0.9em; color: #555;"><strong>${t('source_url_label')}:</strong> <a href="${recipe.sourceUrl}" target="_blank" rel="noopener noreferrer">${recipe.sourceUrl}</a></p>`;
  }
  html += `<div class="meta" style="font-size: 0.9em; color: #777; margin-bottom: 15px;">`;
  if (recipe.servingsValue) html += `<span style="margin-right: 15px;"><strong>${t('export_header_yield')}:</strong> ${recipe.servingsValue} ${servingsUnitText}</span>`;
  if (recipe.prepTime) html += `<span style="margin-right: 15px;"><strong>${t('export_header_prep_time')}:</strong> ${recipe.prepTime}</span>`;
  if (recipe.cookTime) html += `<span><strong>${t('export_header_cook_time')}:</strong> ${recipe.cookTime}</span>`;
  html += `</div>`;

  if (recipe.ingredientGroups && recipe.ingredientGroups.length > 0) {
    recipe.ingredientGroups.forEach(group => {
      html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">${group.name || t('export_header_ingredients')}</h2>`;
      if (group.ingredients && group.ingredients.length > 0) {
        html += `<ul style="margin-left: 20px; padding-left: 0; list-style-position: inside;">`;
        group.ingredients.forEach(ing => {
          html += `<li style="margin-bottom: 5px;">${ing.quantity || ''} ${ing.unit || ''} ${ing.name}</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<p style="color: #777; font-style: italic;">${t('no_ingredients_in_group')}</p>`;
      }
    });
  }

  if (recipe.instructions && recipe.instructions.length > 0) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">${t('export_header_instructions')}</h2>`;
    html += `<ol style="margin-left: 20px; padding-left: 0;">`;
    recipe.instructions.forEach(step => { 
      html += `<li style="margin-bottom: 5px;">${step.text.replace(/\n/g, '<br>')}</li>`;
    });
    html += `</ol>`;
  }

  if (recipe.tips && recipe.tips.length > 0) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">${t('export_header_tips')}</h2>`;
    html += `<ol style="margin-left: 20px; padding-left: 0;">`;
    recipe.tips.forEach(tip => {
      html += `<li style="margin-bottom: 5px;">${tip.text.replace(/\n/g, '<br>')}</li>`;
    });
    html += `</ol>`;
  }
  if (recipe.categories && recipe.categories.length > 0) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">${t('export_header_categories')}</h2><p>${recipe.categories.join(", ")}</p>`;
  }
  if (recipe.tags && recipe.tags.length > 0) {
    html += `<h2 style="color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; margin-bottom: 10px;">${t('export_header_tags')}</h2><p>${recipe.tags.join(", ")}</p>`;
  }
  html += `</div>`;
  return html;
};

const formatRecipeToMarkdown = (recipe: Recipe, t: (key: string, params?:any) => string): string => {
  const servingsUnitText = recipe.servingsUnit === 'pieces' ? t('servings_unit_pieces') : t('servings_unit_servings');
  let md = `# ${recipe.title}\n\n`;
  if (recipe.description) md += `_${recipe.description}_\n\n`;
  if (recipe.sourceUrl) md += `**${t('source_url_label')}:** [${recipe.sourceUrl}](${recipe.sourceUrl})\n\n`;
  if (recipe.servingsValue) md += `**${t('export_header_yield')}:** ${recipe.servingsValue} ${servingsUnitText}\n`;
  if (recipe.prepTime) md += `**${t('export_header_prep_time')}:** ${recipe.prepTime}\n`;
  if (recipe.cookTime) md += `**${t('export_header_cook_time')}:** ${recipe.cookTime}\n\n`;

  if (recipe.ingredientGroups && recipe.ingredientGroups.length > 0) {
    recipe.ingredientGroups.forEach(group => {
      md += `## ${group.name || t('export_header_ingredients')}\n\n`;
      if (group.ingredients && group.ingredients.length > 0) {
        group.ingredients.forEach(ing => {
          md += `- ${ing.quantity || ''} ${ing.unit || ''} ${ing.name}\n`;
        });
      } else {
        md += `_${t('no_ingredients_in_group')}_\n`;
      }
      md += `\n`;
    });
  }

  if (recipe.instructions && recipe.instructions.length > 0) {
    md += `## ${t('export_header_instructions')}\n\n`;
    recipe.instructions.forEach((step, index) => { 
      md += `${index + 1}. ${step.text}\n`;
    });
    md += `\n`;
  }

  if (recipe.tips && recipe.tips.length > 0) {
    md += `## ${t('export_header_tips')}\n\n`;
    recipe.tips.forEach((tip, index) => { 
      md += `${index + 1}. ${tip.text}\n`;
    });
    md += `\n`;
  }

  if (recipe.categories && recipe.categories.length > 0) md += `## ${t('export_header_categories')}\n\n- ${recipe.categories.join("\n- ")}\n\n`;
  if (recipe.tags && recipe.tags.length > 0) md += `## ${t('export_header_tags')}\n\n- ${recipe.tags.join("\n- ")}\n\n`;
  return md;
};


export const RecipeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth(); 
  const { t } = useTranslation(); 

  const mapFirestoreDocToRecipe = useCallback((docData: any, docId: string): Recipe => {
    let ingredientGroupsData: IngredientGroup[];

    if (docData.ingredientGroups && Array.isArray(docData.ingredientGroups)) {
      ingredientGroupsData = docData.ingredientGroups.map((group: any) => ({
        id: group.id || uuidv4(),
        fieldId: group.fieldId || uuidv4(),
        name: group.name || "",
        ingredients: ensureIngredientStructure(group.ingredients || [])
      }));
    } else if (docData.ingredients && Array.isArray(docData.ingredients)) { 
      ingredientGroupsData = [{
        id: uuidv4(),
        fieldId: uuidv4(),
        name: t('default_ingredient_group_name'),
        ingredients: ensureIngredientStructure(docData.ingredients)
      }];
    } else {
      ingredientGroupsData = [ensureIngredientGroupStructure([],t)[0]];
    }
    
    const instructionSteps = ensureInstructionStepsStructure(docData.instructions);
    const tipSteps = ensureTipStepsStructure(docData.tips);

    const servingsValue = docData.servingsValue !== undefined ? docData.servingsValue : (docData.servings !== undefined ? Number(docData.servings) : 1);
    const servingsUnit = docData.servingsUnit || 'servings' as ServingsUnit;

    return {
      id: docId,
      ...docData,
      servingsValue,
      servingsUnit,
      ingredientGroups: ingredientGroupsData,
      instructions: instructionSteps, 
      tips: tipSteps,
      sourceUrl: docData.sourceUrl === null ? undefined : docData.sourceUrl, 
      tags: Array.isArray(docData.tags) ? docData.tags : [],
      categories: Array.isArray(docData.categories) ? docData.categories : [],
      isPublic: docData.isPublic === undefined ? true : docData.isPublic, // Default to true if undefined
      createdAt: docData.createdAt || new Date().toISOString(),
      updatedAt: docData.updatedAt || new Date().toISOString(),
      ratings: docData.ratings || {},
      averageRating: docData.averageRating || 0,
      numRatings: docData.numRatings || 0,
    } as Recipe;
  }, [t]);


  useEffect(() => {
    if (!db) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const recipesCollectionRef = collection(db, "recipes");
    let q;

    if (user && user.uid) {
      // Logged-in users see their own recipes (public or private) AND all other public recipes
      q = query(recipesCollectionRef, 
        or(
          where("createdBy", "==", user.uid), 
          where("isPublic", "==", true)
        )
      );
    } else {
      // Unauthenticated users see NO recipes listed by default.
      // The page.tsx will handle not showing any list.
      // This context will still fetch public recipes in the background for direct URL access,
      // or if rules allow broader reads.
      // For the "no recipes listed by default" goal, the UI on page.tsx is key.
      // If we strictly want this context to fetch nothing for logged-out list views,
      // we would need a condition here to not even set up the listener or use a query
      // that yields no results, but that might interfere with direct URL access functionality.
      // So, keep fetching public recipes, UI will hide them from main list.
      q = query(recipesCollectionRef, where("isPublic", "==", true));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecipes = snapshot.docs.map(doc => mapFirestoreDocToRecipe(doc.data(), doc.id));
      setRecipes(fetchedRecipes);
      setLoading(false);
    }, (error) => {
      console.error("[RecipeContext] Error fetching recipes:", error);
      setRecipes([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, mapFirestoreDocToRecipe]); 


  const addRecipe = async (recipeData: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "ratings" | "averageRating" | "numRatings">): Promise<Recipe> => {
    if (!user || !db) throw new Error(t("user_not_authenticated_or_firestore_not_initialized"));
    
    const newRecipeData = {
      ...recipeData,
      servingsValue: Number(recipeData.servingsValue),
      servingsUnit: recipeData.servingsUnit as ServingsUnit,
      ingredientGroups: ensureIngredientGroupStructure(recipeData.ingredientGroups || [], t),
      instructions: ensureInstructionStepsStructure(recipeData.instructions || []).map(s => ({...s, isChecked: false})),
      tips: ensureTipStepsStructure(recipeData.tips || []).map(tip => ({...tip, isChecked: false})),
      isPublic: recipeData.isPublic === undefined ? true : recipeData.isPublic, // Default to public
      sourceUrl: recipeData.sourceUrl || null, 
      createdBy: user.uid, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ratings: {},
      averageRating: 0,
      numRatings: 0,
    };

    const cleanedIngredientGroups = newRecipeData.ingredientGroups.map(group => ({
      ...group,
      ingredients: group.ingredients.map(({ fieldId, ...restIng }) => restIng),
      fieldId: undefined 
    })).map(({fieldId, ...restGroup}) => restGroup);

    const cleanedInstructions = newRecipeData.instructions.map(({ fieldId, ...restStep }) => restStep);
    const cleanedTips = newRecipeData.tips.map(({ fieldId, ...restStep }) => restStep);

    const payloadToSaveRest = { ...newRecipeData, ingredientGroups: cleanedIngredientGroups, instructions: cleanedInstructions, tips: cleanedTips };
    delete (payloadToSaveRest as any).servings; 

    const docRef = await addDoc(collection(db, "recipes"), payloadToSaveRest);
    return { ...newRecipeData, id: docRef.id }; 
  };

  const updateRecipe = async (updatedRecipe: Recipe): Promise<void> => {
    if (!user || !db) throw new Error(t("user_not_authenticated_or_firestore_not_initialized"));

    const recipeDocRef = doc(db, "recipes", updatedRecipe.id);
    
    const recipePayload = {
      ...updatedRecipe, 
      servingsValue: Number(updatedRecipe.servingsValue),
      servingsUnit: updatedRecipe.servingsUnit as ServingsUnit,
      ingredientGroups: ensureIngredientGroupStructure(updatedRecipe.ingredientGroups || [], t),
      instructions: ensureInstructionStepsStructure(updatedRecipe.instructions || []).map(s => ({...s, isChecked: false})),
      tips: ensureTipStepsStructure(updatedRecipe.tips || []).map(tip => ({...tip, isChecked: false})),
      sourceUrl: updatedRecipe.sourceUrl || null, 
      isPublic: updatedRecipe.isPublic === undefined ? true : updatedRecipe.isPublic, // Default to true if undefined
      updatedAt: new Date().toISOString(),
    };
    
    const cleanedIngredientGroups = recipePayload.ingredientGroups.map(group => ({
      ...group,
      ingredients: group.ingredients.map(({ fieldId, ...restIng }) => restIng),
      fieldId: undefined
    })).map(({fieldId, ...restGroup}) => restGroup);

    const cleanedInstructions = recipePayload.instructions.map(({ fieldId, ...restStep }) => restStep);
    const cleanedTips = recipePayload.tips.map(({ fieldId, ...restStep }) => restStep);

    const { id, ...payloadToSave } = { ...recipePayload, ingredientGroups: cleanedIngredientGroups, instructions: cleanedInstructions, tips: cleanedTips }; 
    delete (payloadToSave as any).servings; 

    await updateDoc(recipeDocRef, payloadToSave);
  };

  const submitRecipeRating = async (recipeId: string, userId: string, rating: number): Promise<void> => {
    if (!user || !db) throw new Error(t("user_not_authenticated_or_firestore_not_initialized"));
    
    const recipeDocRef = doc(db, "recipes", recipeId);
    const recipeSnap = await getDoc(recipeDocRef);

    if (!recipeSnap.exists()) {
      throw new Error(t("recipe_not_found"));
    }

    const currentRecipe = mapFirestoreDocToRecipe(recipeSnap.data(), recipeId);

    // Allow rating if recipe is public OR if the user is the owner (even if private)
    // And ensure user is authenticated
    if (!user || (!currentRecipe.isPublic && currentRecipe.createdBy !== user.uid)) {
        toast({ title: t("unauthorized_action_rate_private"), variant: "destructive" });
        return;
    }
    if (rating < 0 || rating > 5) { 
      throw new Error(t("invalid_rating_value"));
    }

    const newRatings = { ...(currentRecipe.ratings || {}) };
    if (rating === 0) { 
      delete newRatings[userId];
    } else { 
      newRatings[userId] = rating;
    }
    
    const ratingValues = Object.values(newRatings);
    const newNumRatings = ratingValues.length;
    const newAverageRating = newNumRatings > 0 ? ratingValues.reduce((sum, r) => sum + r, 0) / newNumRatings : 0;

    await updateDoc(recipeDocRef, {
      ratings: newRatings,
      averageRating: newAverageRating,
      numRatings: newNumRatings,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteRecipe = async (recipeId: string): Promise<void> => {
     if (!user || !db) throw new Error(t("user_not_authenticated_or_firestore_not_initialized"));
    const recipeToDelete = getRecipeById(recipeId);
    if (!recipeToDelete) throw new Error(t("recipe_not_found"));
    if (recipeToDelete.createdBy !== user.uid && !isAdmin) {
        throw new Error(t("unauthorized_action"));
    }
    await deleteDoc(doc(db, "recipes", recipeId));
  };

  const getRecipeById = (recipeId: string): Recipe | undefined => {
    return recipes.find((r) => r.id === recipeId);
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
  
  const openContentInNewTab = (content: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const newTab = window.open();
    if (newTab) {
      newTab.location.href = url;
    } else {
      console.error("Could not open new tab. Please check your popup blocker settings.");
      toast({title: t("error_opening_new_tab_title"), description: t("error_opening_new_tab_desc"), variant: "destructive"});
    }
  };

  const exportUserRecipesAsHTML = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: t("must_be_logged_in") };
    const userRecipesToExport = recipes.filter(recipe => recipe.createdBy === user.uid);
    if (userRecipesToExport.length === 0) return { success: false, error: t('no_recipe_to_export') };
    try {
      let allRecipesHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t('export_html_title_my_recipes')}</title><style>body{font-family:sans-serif;line-height:1.6;margin:20px;color:#333;} .recipe{margin-bottom:40px;padding:20px;border:1px solid #eee;border-radius:8px;} h1{color:#d66800;font-size:1.8em;} h2{color:#333;border-bottom:1px solid #e0e0e0;padding-bottom:8px;margin-top:25px;font-size:1.4em;} ul,ol{margin-left:20px;} li{margin-bottom:6px;} .meta{font-size:0.9em;color:#666;margin-bottom:20px;}</style></head><body>`;
      userRecipesToExport.forEach(recipe => { allRecipesHTML += formatRecipeToHTML(recipe, t, false); });
      allRecipesHTML += `</body></html>`;
      triggerDownload(allRecipesHTML, `oppskrift_recipes_export_${new Date().toISOString().split('T')[0]}.html`, "text/html;charset=utf-8");
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message || t("error_exporting_html") }; }
  };

  const exportUserRecipesAsMarkdown = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: t("must_be_logged_in") };
    const userRecipesToExport = recipes.filter(recipe => recipe.createdBy === user.uid);
    if (userRecipesToExport.length === 0) return { success: false, error: t('no_recipe_to_export') };
    try {
      const allRecipesMD = userRecipesToExport.map(recipe => formatRecipeToMarkdown(recipe, t)).join("\n\n---\n\n");
      triggerDownload(allRecipesMD, `oppskrift_recipes_export_${new Date().toISOString().split('T')[0]}.md`, "text/markdown;charset=utf-8");
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message || t("error_exporting_markdown") }; }
  };
  
  const exportSingleRecipeAsHTML = async (recipeId: string, currentScaledServings?: number): Promise<{ success: boolean; error?: string }> => {
    const originalRecipe = recipes.find(r => r.id === recipeId); 
    if (!originalRecipe) return { success: false, error: t('no_recipe_to_export') };

    let recipeToExport = originalRecipe;

    if (currentScaledServings &&
        originalRecipe.servingsValue > 0 &&
        currentScaledServings !== originalRecipe.servingsValue) {
        
        recipeToExport = {
            ...originalRecipe,
            servingsValue: currentScaledServings,
            ingredientGroups: originalRecipe.ingredientGroups.map(group => ({
                ...group,
                ingredients: group.ingredients.map(ing => ({
                    ...ing,
                    quantity: scaleIngredientQuantity(
                        ing.quantity,
                        originalRecipe.servingsValue,
                        currentScaledServings
                    )
                }))
            }))
        };
    }

    try {
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t('export_html_title_recipe', { title: recipeToExport.title })}</title><style>body{font-family:sans-serif;line-height:1.6;margin:20px;color:#333;} .recipe{margin-bottom:40px;padding:20px;border:1px solid #eee;border-radius:8px;} h1{color:#d66800;font-size:1.8em;} h2{color:#333;border-bottom:1px solid #e0e0e0;padding-bottom:8px;margin-top:25px;font-size:1.4em;} ul,ol{margin-left:20px;} li{margin-bottom:6px;} .meta{font-size:0.9em;color:#666;margin-bottom:20px;}</style></head><body>${formatRecipeToHTML(recipeToExport, t, true)}</body></html>`;
      openContentInNewTab(htmlContent, "text/html;charset=utf-8");
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message || t("error_exporting_html") }; }
  };

  const exportSingleRecipeAsMarkdown = async (recipeId: string, currentScaledServings?: number): Promise<{ success: boolean; error?: string }> => {
    const originalRecipe = recipes.find(r => r.id === recipeId); 
    if (!originalRecipe) return { success: false, error: t('no_recipe_to_export') };

    let recipeToExport = originalRecipe;

    if (currentScaledServings &&
        originalRecipe.servingsValue > 0 &&
        currentScaledServings !== originalRecipe.servingsValue) {
        
        recipeToExport = {
            ...originalRecipe,
            servingsValue: currentScaledServings,
            ingredientGroups: originalRecipe.ingredientGroups.map(group => ({
                ...group,
                ingredients: group.ingredients.map(ing => ({
                    ...ing,
                    quantity: scaleIngredientQuantity(
                        ing.quantity,
                        originalRecipe.servingsValue,
                        currentScaledServings
                    )
                }))
            }))
        };
    }

    try {
      const mdContent = formatRecipeToMarkdown(recipeToExport, t);
      openContentInNewTab(mdContent, "text/plain;charset=utf-8");
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message || t("error_exporting_markdown") }; }
  };

  const exportUserRecipes = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: t("must_be_logged_in") };
    const userRecipesToExport = recipes.filter(recipe => recipe.createdBy === user.uid)
                                     .map(r => {
                                        const { servings, ...restOfRecipe } = r as any; 
                                        return {
                                          ...restOfRecipe,
                                          servingsValue: r.servingsValue,
                                          servingsUnit: r.servingsUnit,
                                          sourceUrl: r.sourceUrl || null, 
                                          ingredientGroups: r.ingredientGroups.map(g => ({...g, ingredients: g.ingredients.map(({fieldId, ...restI}) => restI), fieldId: undefined})).map(({fieldId, ...restG})=> restG),
                                          instructions: r.instructions.map(({fieldId, ...restS}) => ({...restS, isChecked: false})),
                                          tips: r.tips ? r.tips.map(({fieldId, ...restT}) => ({...restT, isChecked: false})) : [],
                                        };
                                      });
    if (userRecipesToExport.length === 0) return { success: false, error: t('no_recipe_to_export') };
    try {
      const jsonString = JSON.stringify(userRecipesToExport, null, 2);
      triggerDownload(jsonString, `oppskrift_recipes_export_${new Date().toISOString().split('T')[0]}.json`, "application/json;charset=utf-8");
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message || t("error_exporting_recipes") }; }
  };

  const importRecipes = async (jsonString: string): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!user) return { success: false, count: 0, error: t("must_be_logged_in") };
    try {
      const importedRecipeObjects = JSON.parse(jsonString);
      if (!Array.isArray(importedRecipeObjects)) return { success: false, count: 0, error: t("invalid_json_file_format") };
      let importedCount = 0;
      for (const recipeObj of importedRecipeObjects) {
        if (!recipeObj.title) { console.warn("Skipping invalid recipe object during import (missing title):", recipeObj); continue; }
        
        let ingredientGroupsToImport: IngredientGroup[];
        if (recipeObj.ingredientGroups && Array.isArray(recipeObj.ingredientGroups)) {
            ingredientGroupsToImport = recipeObj.ingredientGroups.map((group: any) => ({
                id: group.id || uuidv4(),
                name: group.name || "",
                ingredients: ensureIngredientStructure(group.ingredients || [])
            }));
        } else if (recipeObj.ingredients && Array.isArray(recipeObj.ingredients)) { 
            ingredientGroupsToImport = [{
                id: uuidv4(),
                name: t('default_ingredient_group_name'),
                ingredients: ensureIngredientStructure(recipeObj.ingredients)
            }];
        } else {
            ingredientGroupsToImport = [ensureIngredientGroupStructure([], t)[0]];
        }

        const instructionsToImport = ensureInstructionStepsStructure(recipeObj.instructions || [{id: uuidv4(), text: recipeObj.instructions || "", isChecked: false}]);
        const tipsToImport = ensureTipStepsStructure(recipeObj.tips || []);

        const servingsValue = recipeObj.servingsValue !== undefined ? Number(recipeObj.servingsValue) : (recipeObj.servings !== undefined ? Number(recipeObj.servings) : 1);
        const servingsUnit = recipeObj.servingsUnit || 'servings' as ServingsUnit;


        const recipeToImport: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "ratings" | "averageRating" | "numRatings"> = {
          title: recipeObj.title,
          description: recipeObj.description || "",
          ingredientGroups: ingredientGroupsToImport,
          instructions: instructionsToImport.map(s => ({...s, isChecked: false})), 
          tips: tipsToImport.map(t => ({...t, isChecked: false})), 
          tags: Array.isArray(recipeObj.tags) ? recipeObj.tags.map(String) : [],
          categories: Array.isArray(recipeObj.categories) ? recipeObj.categories.map(String) : [],
          servingsValue,
          servingsUnit,
          prepTime: recipeObj.prepTime || "",
          cookTime: recipeObj.cookTime || "",
          imageUrl: recipeObj.imageUrl || "",
          sourceUrl: recipeObj.sourceUrl || null, 
          isPublic: recipeObj.isPublic === undefined ? true : recipeObj.isPublic, // Default imported recipes to public
          createdBy: user.uid, 
        };
        await addRecipe(recipeToImport); 
        importedCount++;
      }
      return { success: true, count: importedCount };
    } catch (e: any) { return { success: false, count: 0, error: e.message || t("error_importing_recipes") }; }
  };
  
  return (
    <RecipeContext.Provider value={{ recipes, addRecipe, updateRecipe, deleteRecipe, getRecipeById, submitRecipeRating, loading, exportUserRecipes, importRecipes, exportUserRecipesAsHTML, exportUserRecipesAsMarkdown, exportSingleRecipeAsHTML, exportSingleRecipeAsMarkdown }}>
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipes = (): RecipeContextType => {
  const context = useContext(RecipeContext);
  if (context === undefined) throw new Error("useRecipes must be used within a RecipeProvider");
  return context;
};

