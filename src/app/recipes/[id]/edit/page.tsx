
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RecipeForm } from "@/components/recipe/RecipeForm";
import { useRecipes } from "@/contexts/RecipeContext";
import type { Recipe } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;
  
  const { getRecipeById, loading: recipesLoading } = useRecipes();
  const { user, loading: authLoading, isUserApproved } = useAuth();
  const { t } = useTranslation();
  
  const [initialData, setInitialData] = useState<Recipe | null | undefined>(undefined); 

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/login");
        return;
      }
      // If user is loaded but not approved, they shouldn't be able to edit.
      // The recipe loading itself depends on `isUserApproved` for ownership check.
    }
  }, [user, authLoading, router, isUserApproved]);

  useEffect(() => {
    if (recipeId && !recipesLoading && user) { 
      if (!isUserApproved && getRecipeById(recipeId)?.createdBy === user.uid) {
        // User owns the recipe but is not approved. For simplicity, block edit for now.
        // Or, allow edit but warn that it might not be visible based on their approval status.
        // For now, consistent with add: block if not approved.
        setInitialData(null); // Treat as unauthorized for rendering the message below
        return;
      }

      const recipe = getRecipeById(recipeId);
      if (recipe) {
        if (recipe.createdBy !== user.uid) { 
          toast({ title: t("error_generic_title"), description: t("unauthorized_edit_recipe"), variant: "destructive" });
          setInitialData(null); 
          router.replace(`/recipes/${recipeId}`); 
        } else {
          setInitialData(recipe);
        }
      } else {
        setInitialData(null); 
      }
    }
  }, [recipeId, getRecipeById, recipesLoading, user, router, t, isUserApproved]);

  const isLoading = authLoading || recipesLoading || initialData === undefined;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto my-10" />
        <Skeleton className="h-10 w-1/3" />
        {/* ... other skeletons ... */}
      </div>
    );
  }
  
  if (user && !isUserApproved && initialData === null && getRecipeById(recipeId)?.createdBy === user.uid) {
    // This case means: user owns it, but they are not approved.
    return (
      <div className="max-w-xl mx-auto mt-10">
        <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="font-semibold text-yellow-800">{t('account_pending_approval_title')}</AlertTitle>
          <AlertDescription className="text-yellow-700">
            {t('cannot_edit_recipe_pending_approval_desc')}
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push(`/recipes/${recipeId}`)} variant="outline" className="mt-6">
            {t('back_to_view_recipe')}
        </Button>
      </div>
    );
  }


  if (initialData === null) {
     return <div className="text-center py-10 text-xl text-muted-foreground">{t('recipe_not_found_or_unauthorized_edit')}</div>;
  }

  return <RecipeForm initialData={initialData} isEditMode />;
}
