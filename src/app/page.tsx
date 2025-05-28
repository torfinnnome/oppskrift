
"use client";

import { useState, Suspense } from "react"; // Added Suspense
import { useSearchParams, useRouter } // Added useRouter
from "next/navigation"; 
import { useRecipes } from "@/contexts/RecipeContext";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { PlusCircle, Search, Frown, XCircle, Loader2, Tag, Bookmark } from "lucide-react"; // Added XCircle, Loader2, Tag, Bookmark
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function HomePageContent() {
  const { recipes, loading: recipesLoading } = useRecipes();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const tagFilter = searchParams.get("tag");

  const [searchTerm, setSearchTerm] = useState("");

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearchTerm = searchTerm ? 
      recipe.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (recipe.tags && recipe.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) || // Added check for recipe.tags
      (recipe.categories && recipe.categories.some(category => category.toLowerCase().includes(searchTerm.toLowerCase())))
      : true;

    let matchesCategoryOrTagFilter = true;
    if (categoryFilter) {
      matchesCategoryOrTagFilter = recipe.categories && recipe.categories.some(category => category.toLowerCase() === categoryFilter.toLowerCase());
    } else if (tagFilter) {
      matchesCategoryOrTagFilter = recipe.tags && recipe.tags.some(tag => tag.toLowerCase() === tagFilter.toLowerCase());
    }

    return matchesSearchTerm && matchesCategoryOrTagFilter;
  });

  const isLoading = recipesLoading || authLoading;

  const handleClearFilter = () => {
    router.push("/"); 
  };

  if (!user && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <h1 className="text-3xl font-bold mb-4">{t('app_title')}</h1>
        <p className="text-lg text-muted-foreground mb-6">{t('description')}</p>
        <div className="space-x-4">
          <Button asChild size="lg">
            <Link href="/login">{t('login')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">{t('signup')}</Link>
          </Button>
        </div>
      </div>
    );
  }
  
  const activeFilterValue = categoryFilter || tagFilter;
  const activeFilterType = categoryFilter ? 'category' : (tagFilter ? 'tag' : null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t('my_recipes')}</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('search_recipes')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full"
            />
          </div>
          {user && (
            <Button asChild>
              <Link href="/recipes/new">
                <PlusCircle className="mr-2 h-4 w-4" /> {t('add_recipe')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {activeFilterValue && activeFilterType && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">
            {activeFilterType === 'category' ? t('filtering_by_category') : t('filtering_by_tag')}:
          </span>
          {activeFilterType === 'category' && <Bookmark className="h-4 w-4 text-muted-foreground" />}
          {activeFilterType === 'tag' && <Tag className="h-4 w-4 text-muted-foreground" />}
          <Badge variant={activeFilterType === 'category' ? "secondary" : "outline"}>{activeFilterValue}</Badge>
          <Button variant="ghost" size="sm" onClick={handleClearFilter} className="text-primary hover:text-primary/80">
            <XCircle className="mr-1 h-4 w-4" />
            {t('clear_filter')}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="h-[192px] w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Frown className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {activeFilterType === 'category' && categoryFilter ? t('no_recipes_found_for_category', { category: categoryFilter }) : 
             activeFilterType === 'tag' && tagFilter ? t('no_recipes_found_for_tag', { tag: tagFilter }) :
             t('no_recipes_found')}
          </p>
          {activeFilterValue && (
             <Button variant="link" onClick={handleClearFilter} className="mt-2">
                {t('show_all_recipes')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <HomePageContent />
    </Suspense>
  );
}
