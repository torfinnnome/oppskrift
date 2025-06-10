
"use client";

import { RecipeForm } from "@/components/recipe/RecipeForm";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NewRecipePage() {
  const { user, loading, isUserApproved } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (!isUserApproved) {
        // Don't redirect, show message instead
      }
    }
  }, [user, loading, isUserApproved, router]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto my-10" />
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

  if (!user) { // Should have been redirected, but as a fallback
    return (
         <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <p>{t('must_be_logged_in')}</p>
            <Button onClick={() => router.push('/login')} className="mt-4">{t('login')}</Button>
        </div>
    );
  }

  if (!isUserApproved) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="font-semibold text-yellow-800">{t('account_pending_approval_title')}</AlertTitle>
          <AlertDescription className="text-yellow-700">
            {t('cannot_add_recipe_pending_approval_desc')}
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/')} variant="outline" className="mt-6">
            {t('back_to_homepage')}
        </Button>
      </div>
    );
  }

  return <RecipeForm />;
}
