
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RecipeForm } from "@/components/recipe/RecipeForm";
import { useRecipes } from "@/contexts/RecipeContext";
import type { Recipe } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast"; // Added import

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;
  
  const { getRecipeById, loading: recipesLoading } = useRecipes();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  
  const [initialData, setInitialData] = useState<Recipe | null | undefined>(undefined); // undefined: loading, null: not found/unauthorized

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (recipeId && !recipesLoading && user) { // Ensure user is available for ownership check
      const recipe = getRecipeById(recipeId);
      if (recipe) {
        // Ensure we compare against Firebase UID (user.uid)
        if (recipe.createdBy !== user.uid) { 
          // User does not own this recipe
          toast({ title: t("error_generic_title"), description: t("unauthorized_edit_recipe"), variant: "destructive" });
          setInitialData(null); // Mark as unauthorized / not found for rendering
          router.replace(`/recipes/${recipeId}`); // Redirect back to view page
        } else {
          setInitialData(recipe);
        }
      } else {
        setInitialData(null); // Recipe not found
      }
    }
  }, [recipeId, getRecipeById, recipesLoading, user, router, t]);

  const isLoading = authLoading || recipesLoading || initialData === undefined;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-8 w-1/4" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (initialData === null) {
     // Message for recipe not found is handled here. Unauthorized is handled by redirect and toast.
     // This path is primarily for recipe not found after loading.
     return <div className="text-center py-10 text-xl text-muted-foreground">{t('recipe_not_found')}</div>;
  }

  return <RecipeForm initialData={initialData} isEditMode />;
}

