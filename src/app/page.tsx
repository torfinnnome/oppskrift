
"use client";

import { useState, Suspense, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useRecipes } from "@/contexts/RecipeContext";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";
import { PlusCircle, Search, Frown, XCircle, Loader2, Tag, Bookmark, Eye, Users, Lock, ListFilter, BookOpen, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Recipe } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const { data: session, status } = useSession();

  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const tagFilter = searchParams.get("tag");

  const [searchTerm, setSearchTerm] = useState("");

  const visibilityFilter: VisibilityFilter = useMemo(() => {
    const urlVisibility = searchParams.get("visibility") as VisibilityFilter;
    return visibilityFilterOptions.some(opt => opt.value === urlVisibility) ? urlVisibility : "all-viewable";
  }, [searchParams]);

  const handleVisibilityChange = (value: VisibilityFilter) => {
    const currentParams = new URLSearchParams(Array.from(searchParams.entries()));
    currentParams.set('visibility', value);
    router.push(`?${currentParams.toString()}`);
  };

  const isLoading = recipesLoading || status === 'loading';

  const handleClearFilters = () => {
    router.push("/");
    setSearchTerm("");
  };
  
  const filteredRecipes = useMemo(() => {
    let currentRecipes = [...recipes]; 

    if (session) {
      if (!session.user.isApproved) {
        return []; // If user is logged in but not approved, show no recipes
      }

      if (visibilityFilter === "my-all") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy === session.user.id);
      } else if (visibilityFilter === "my-public") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy === session.user.id && recipe.isPublic);
      } else if (visibilityFilter === "my-private") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy === session.user.id && !recipe.isPublic);
      } else if (visibilityFilter === "community-public") {
        currentRecipes = currentRecipes.filter(recipe => recipe.createdBy !== session.user.id && recipe.isPublic);
      }
    } else {
        return [];
    }

    if (categoryFilter) {
      currentRecipes = currentRecipes.filter(recipe =>
        recipe.categories && recipe.categories.some(category => category.name.toLowerCase() === categoryFilter.toLowerCase())
      );
    } else if (tagFilter) {
      currentRecipes = currentRecipes.filter(recipe =>
        recipe.tags && recipe.tags.some(tag => tag.name.toLowerCase() === tagFilter.toLowerCase())
      );
    }

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      currentRecipes = currentRecipes.filter(recipe => {
        const titleMatch = recipe.title.toLowerCase().includes(lowerSearchTerm);
        const descriptionMatch = recipe.description?.toLowerCase().includes(lowerSearchTerm) || false;
        const categoryMatch = recipe.categories?.some(cat => cat.name.toLowerCase().includes(lowerSearchTerm)) || false;
        const tagMatch = recipe.tags?.some(tag => tag.name.toLowerCase().includes(lowerSearchTerm)) || false;
        const ingredientMatch = recipe.ingredientGroups?.some(group => group.ingredients.some(ing => ing.name.toLowerCase().includes(lowerSearchTerm))) || false;
        return titleMatch || descriptionMatch || categoryMatch || tagMatch || ingredientMatch;
      });
    }
    return currentRecipes;
  }, [recipes, session, visibilityFilter, categoryFilter, tagFilter, searchTerm]);


  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <BookOpen className="h-24 w-24 text-primary mb-6" />
        <h1 className="text-3xl font-bold mb-4">{t('welcome_to_oppskrift_title')}</h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-md">{t('welcome_to_oppskrift_desc_unauthenticated')}</p>
        <div className="space-x-4">
          <Button asChild size="lg">
            <Link href="/login">{t('login')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">{t('signup')}</Link>
          </Button>
        </div>
         <p className="text-sm text-muted-foreground mt-8">
          {t('direct_url_access_note')}
        </p>
      </div>
    );
  }
  
  const activeFilterValue = categoryFilter || tagFilter;
  const activeFilterType = categoryFilter ? 'category' : (tagFilter ? 'tag' : null);
  const myAllIsActiveBadge = session && visibilityFilter === "my-all" && (!!categoryFilter || !!tagFilter);
  const otherVisibilityFilterActive = session && visibilityFilter !== "all-viewable"; 
  const isAnyFilterActive = activeFilterValue || searchTerm || myAllIsActiveBadge || otherVisibilityFilterActive;


  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{session ? t('recipes_title_authenticated') : t('app_title')}</h1>
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
          {session && (
            <Select value={visibilityFilter} onValueChange={handleVisibilityChange}>
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
          {session && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/recipes/new">
                <PlusCircle className="mr-2 h-4 w-4" /> {t('add_recipe')}
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      {session && !session.user.isApproved && status !== 'loading' && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertTitle className="font-semibold text-yellow-800">{t('account_pending_approval_title')}</AlertTitle>
          <AlertDescription className="text-yellow-700">
            {t('account_pending_approval_desc')}
          </AlertDescription>
        </Alert>
      )}


      {isAnyFilterActive && (
        <div className="flex items-center gap-2 mb-4 flex-wrap p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">{t('active_filters')}:</span>
          {categoryFilter && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Bookmark className="h-3 w-3" /> {t('category')}: {categoryFilter}
              <Button variant="ghost" size="xs" onClick={() => router.push(tagFilter ? `/?tag=${tagFilter}` : "/")} className="ml-1 h-5 w-5 p-0.5"><XCircle className="h-3 w-3"/></Button>
            </Badge>
          )}
          {tagFilter && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Tag className="h-3 w-3" /> {t('tag')}: {tagFilter}
              <Button variant="ghost" size="xs" onClick={() => router.push(categoryFilter ? `/?category=${categoryFilter}` : "/")} className="ml-1 h-5 w-5 p-0.5"><XCircle className="h-3 w-3"/></Button>
            </Badge>
          )}
          {session && visibilityFilter !== "all-viewable" && (
            <Badge variant="default" className="flex items-center gap-1">
              <ListFilter className="h-3 w-3" /> {t(visibilityFilterOptions.find(opt => opt.value === visibilityFilter)?.labelKey || 'Filter')}
               <Button variant="ghost" size="xs" onClick={() => handleVisibilityChange('all-viewable')} className="ml-1 h-5 w-5 p-0.5 hover:bg-primary-foreground/20"><XCircle className="h-3 w-3"/></Button>
            </Badge>
          )}
          
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-primary hover:text-primary/80 ml-auto">
              <XCircle className="mr-1 h-4 w-4" />
              {t('clear_all_filters')}
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
      ) : session && filteredRecipes.length > 0 ? ( 
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : session ? ( 
        <div className="text-center py-12">
          <Frown className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">
            {activeFilterType === 'category' && categoryFilter ? t('no_recipes_found_for_category', { category: categoryFilter }) : 
             activeFilterType === 'tag' && tagFilter ? t('no_recipes_found_for_tag', { tag: tagFilter }) :
             (session && visibilityFilter !== "all-viewable") ? t('no_recipes_found_for_visibility', { filter: t(visibilityFilterOptions.find(opt => opt.value === visibilityFilter)?.labelKey || 'current filter')}) :
             searchTerm ? t('no_recipes_found_for_search', { term: searchTerm }) :
             (session.user.isApproved ? t('no_recipes_found_authenticated_user') : t('account_pending_approval_no_recipes'))}
          </p>
          {isAnyFilterActive && (
             <Button variant="link" onClick={handleClearFilters} className="mt-2">
                {t('show_all_recipes')}
            </Button>
          )}
           {!isAnyFilterActive && session.user.isApproved && (
             <Button asChild className="mt-4">
              <Link href="/recipes/new">
                <PlusCircle className="mr-2 h-4 w-4" /> {t('add_your_first_recipe_button')}
              </Link>
            </Button>
           )}
        </div>
      ) : null }
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
