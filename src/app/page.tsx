
"use client";

import { useState, Suspense, useEffect, useMemo } from "react"; // Added useMemo
import { useSearchParams, useRouter } from "next/navigation";
import { useRecipes } from "@/contexts/RecipeContext";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { PlusCircle, Search, Frown, XCircle, Loader2, Tag, Bookmark, Eye, Users, Lock, ListFilter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Recipe } from "@/types";

type VisibilityFilter = "all-viewable" | "my-all" | "my-public" | "my-private" | "community-public";

const visibilityFilterOptions: { value: VisibilityFilter; labelKey: string; icon?: React.ElementType }[] = [
  { value: "all-viewable", labelKey: "visibility_option_all_viewable", icon: ListFilter },
  { value: "my-all", labelKey: "visibility_option_my_all", icon: Users },
  { value: "my-public", labelKey: "visibility_option_my_public", icon: Eye },
  { value: "my-private", labelKey: "visibility_option_my_private", icon: Lock },
  { value: "community-public", labelKey: "visibility_option_community_public", icon: Eye },
];

function HomePageContent() {
  const { recipes, loading: recipesLoading } = useRecipes();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const tagFilter = searchParams.get("tag");

  const [searchTerm, setSearchTerm] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all-viewable");

  const isLoading = recipesLoading || authLoading;

  const handleClearFilters = () => {
    router.push("/");
    setVisibilityFilter("all-viewable");
    setSearchTerm("");
  };
  
  const filteredRecipes = useMemo(() => {
    let currentRecipes = recipes;

    // 1. Apply visibility filter (if user is logged in)
    if (user && visibilityFilter !== "all-viewable") {
      if (visibilityFilter === "my-all") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy === user.uid);
      } else if (visibilityFilter === "my-public") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy === user.uid && recipe.isPublic);
      } else if (visibilityFilter === "my-private") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy === user.uid && !recipe.isPublic);
      } else if (visibilityFilter === "community-public") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy !== user.uid && recipe.isPublic);
      }
    } else if (!user) { // For logged-out users, ensure only public are shown by default from context
        currentRecipes = currentRecipes.filter(recipe => recipe.isPublic);
    }


    // 2. Apply category or tag filter (from URL params)
    if (categoryFilter) {
      currentRecipes = currentRecipes.filter(recipe =>
        recipe.categories && recipe.categories.some(category => category.toLowerCase() === categoryFilter.toLowerCase())
      );
    } else if (tagFilter) {
      currentRecipes = currentRecipes.filter(recipe =>
        recipe.tags && recipe.tags.some(tag => tag.toLowerCase() === tagFilter.toLowerCase())
      );
    }

    // 3. Apply search term filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      currentRecipes = currentRecipes.filter(recipe => {
        const titleMatch = recipe.title.toLowerCase().includes(lowerSearchTerm);
        const descriptionMatch = recipe.description?.toLowerCase().includes(lowerSearchTerm) || false;
        const categoryMatch = recipe.categories?.some(cat => cat.toLowerCase().includes(lowerSearchTerm)) || false;
        const tagMatch = recipe.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm)) || false;
        const ingredientMatch = recipe.ingredients?.some(ing => ing.name.toLowerCase().includes(lowerSearchTerm)) || false;
        return titleMatch || descriptionMatch || categoryMatch || tagMatch || ingredientMatch;
      });
    }
    return currentRecipes;
  }, [recipes, user, visibilityFilter, categoryFilter, tagFilter, searchTerm]);


  const publicRecipesFromContext = useMemo(() => recipes.filter(r => r.isPublic), [recipes]);

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
        { publicRecipesFromContext.length > 0 && (
          <div className="mt-12 w-full max-w-4xl">
            <h2 className="text-2xl font-semibold mb-4">{t('public_recipes_preview_title')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicRecipesFromContext.slice(0,3).map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
             {publicRecipesFromContext.length > 3 && (
              <Button variant="link" asChild className="mt-4">
                <Link href="/login">{t('login_to_see_more_public_recipes')}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }
  
  const activeFilterValue = categoryFilter || tagFilter;
  const activeFilterType = categoryFilter ? 'category' : (tagFilter ? 'tag' : null);
  const isAnyFilterActive = activeFilterValue || (user && visibilityFilter !== "all-viewable") || searchTerm;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t('my_recipes')}</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('search_recipes_placeholder_enhanced')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full"
            />
          </div>
          {user && (
            <Select value={visibilityFilter} onValueChange={(value) => setVisibilityFilter(value as VisibilityFilter)}>
              <SelectTrigger className="w-full sm:w-[230px]">
                <SelectValue placeholder={t('visibility_filter_label')} />
              </SelectTrigger>
              <SelectContent>
                {visibilityFilterOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      {opt.icon && <opt.icon className="h-4 w-4 text-muted-foreground" />}
                      {t(opt.labelKey)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {user && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/recipes/new">
                <PlusCircle className="mr-2 h-4 w-4" /> {t('add_recipe')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isAnyFilterActive && (
        <div className="flex items-center gap-2 mb-4 flex-wrap p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">{t('active_filters')}:</span>
          {categoryFilter && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" /> {t('category')}: {categoryFilter}
              <Button variant="ghost" size="xs" onClick={() => router.push(tagFilter ? `/?tag=${tagFilter}` : (visibilityFilter !== "all-viewable" ? `/?visibility=${visibilityFilter}` : "/"))} className="ml-1 h-5 w-5 p-0.5"><XCircle className="h-3 w-3"/></Button>
            </Badge>
          )}
          {tagFilter && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Tag className="h-3 w-3" /> {t('tag')}: {tagFilter}
              <Button variant="ghost" size="xs" onClick={() => router.push(categoryFilter ? `/?category=${categoryFilter}` : (visibilityFilter !== "all-viewable" ? `/?visibility=${visibilityFilter}` : "/"))} className="ml-1 h-5 w-5 p-0.5"><XCircle className="h-3 w-3"/></Button>
            </Badge>
          )}
          {user && visibilityFilter !== "all-viewable" && (
            <Badge variant="default" className="flex items-center gap-1">
              <ListFilter className="h-3 w-3" /> {t(visibilityFilterOptions.find(opt => opt.value === visibilityFilter)?.labelKey || 'Filter')}
               <Button variant="ghost" size="xs" onClick={() => setVisibilityFilter("all-viewable")} className="ml-1 h-5 w-5 p-0.5 hover:bg-primary-foreground/20"><XCircle className="h-3 w-3"/></Button>
            </Badge>
          )}
          {(categoryFilter || tagFilter || (user && visibilityFilter !== "all-viewable")) && (
             <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-primary hover:text-primary/80 ml-auto">
                <XCircle className="mr-1 h-4 w-4" />
                {t('clear_all_filters')}
            </Button>
          )}
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
             (user && visibilityFilter !== "all-viewable") ? t('no_recipes_found_for_visibility', { filter: t(visibilityFilterOptions.find(opt => opt.value === visibilityFilter)?.labelKey || 'current filter')}) :
             searchTerm ? t('no_recipes_found_for_search', { term: searchTerm }) :
             t('no_recipes_found')}
          </p>
          {isAnyFilterActive && (
             <Button variant="link" onClick={handleClearFilters} className="mt-2">
                {t('show_all_recipes')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <HomePageContent />
    </Suspense>
  );
}

    