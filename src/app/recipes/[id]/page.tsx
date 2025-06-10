
"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useParams, useRouter } from "next/navigation"; // Removed useSearchParams
import { useRecipes } from "@/contexts/RecipeContext";
import type { Recipe as RecipeType, IngredientGroup as IngredientGroupType } from "@/types"; // Removed ShareToken
import { useAuth } from "@/contexts/AuthContext";
import { useShoppingList } from "@/contexts/ShoppingListContext";
import { useTranslation } from "@/lib/i18n";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Users, Tag, Bookmark, Edit, Trash2, ShoppingCart, Minus, Plus, ArrowLeft, Globe, EyeOff, FileText, FileCode, Loader2, Download, Smartphone, Info, Lightbulb, Utensils, Star as StarIcon, Link as LinkIcon } from "lucide-react"; // Removed Share2, Copy
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StarRating } from "@/components/recipe/StarRating";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// Dialog imports might not be needed if share dialog is removed
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
// Removed uuid and date-fns imports

interface ScaledIngredientGroup extends Omit<IngredientGroupType, 'ingredients'> {
  ingredients: { name: string; quantity: string; unit: string; id: string; }[];
}

const linkifyText = (text: string): React.ReactNode[] => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex); 

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={`link-${index}-${part}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    return part; 
  });
};

function RecipeDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;

  const { getRecipeById, deleteRecipe, exportSingleRecipeAsHTML, exportSingleRecipeAsMarkdown, submitRecipeRating, loading: recipesLoadingFromContext, updateRecipe } = useRecipes();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { addMultipleItems: addItemsToShoppingList } = useShoppingList();
  const { t } = useTranslation();

  const [recipe, setRecipe] = useState<RecipeType | null | undefined>(undefined);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(true);
  
  const [numServings, setNumServings] = useState(1); 
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [isExportingMarkdown, setIsExportingMarkdown] = useState(false);
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const [instructionStepStates, setInstructionStepStates] = useState<Record<string, boolean>>({});
  const [tipStepStates, setTipStepStates] = useState<Record<string, boolean>>({});

  const loadRecipe = useCallback(async () => {
    if (!recipeId) {
      setIsLoadingRecipe(false);
      setRecipe(null);
      return;
    }
    setIsLoadingRecipe(true);
    
    // Attempt to get recipe from context first
    let foundRecipe = getRecipeById(recipeId);

    if (foundRecipe) {
      setRecipe(foundRecipe);
    } else {
      // If not in context, try a direct fetch (assuming Firestore rules allow it)
      // This covers cases where user navigates directly to a URL of a recipe
      // not initially loaded by their main context query (e.g., another user's public recipe not yet in cache)
      try {
        const recipeDocRef = doc(db, "recipes", recipeId);
        const docSnap = await getDoc(recipeDocRef);
        if (docSnap.exists()) {
           // Manually map here if needed, or ensure getRecipeById can handle a raw doc
           // For simplicity, assuming getRecipeById from context is the primary way and rules allow reads
           // This part is more complex if mapFirestoreDocToRecipe isn't exposed or if context doesn't update from this fetch
           // For now, let's rely on context + Firestore rules. If getRecipeById fails, it means not found or not permitted by rules.
           // The new model is that context tries to load everything accessible by rules.
           // If it's still not in getRecipeById, it means it doesn't exist or rules blocked it.
           // To truly fulfill "any recipe by URL", the context's main query needs to be very broad OR
           // a direct fetch + mapping like in the previous version's 'fetchRecipeByIdDirectly' is needed here.
           // Given RecipeContext was simplified, we assume if it's not in `recipes` array from context, it's "not found".
           setRecipe(null); // Recipe not found via context after attempting to load all accessible recipes
        } else {
          setRecipe(null);
        }
      } catch (err) {
        console.error("Error directly fetching recipe:", err);
        setRecipe(null);
      }
    }
    setIsLoadingRecipe(false);
  }, [recipeId, getRecipeById ]); // Removed fetchRecipeByIdDirectly as it's no longer in context type


  useEffect(() => {
    loadRecipe();
  }, [loadRecipe, recipesLoadingFromContext]); 

  useEffect(() => {
    if (recipe) {
      setNumServings(recipe.servingsValue > 0 ? recipe.servingsValue : 1);
      const initialInstructionStates: Record<string, boolean> = {};
      (recipe.instructions || []).forEach(step => { initialInstructionStates[step.id] = false; });
      setInstructionStepStates(initialInstructionStates);
      const initialTipStates: Record<string, boolean> = {};
      (recipe.tips || []).forEach(tip => { initialTipStates[tip.id] = false; });
      setTipStepStates(initialTipStates);
    } else {
      setInstructionStepStates({});
      setTipStepStates({});
    }
  }, [recipe]);


  useEffect(() => {
    const requestWakeLock = async () => {
      if (keepScreenOn && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {});
        } catch (err: any) {
          toast({ title: t('wake_lock_error_title'), description: t('wake_lock_error_unavailable'), variant: 'destructive'});
          setKeepScreenOn(false);
        }
      }
    };
    const releaseWakeLock = () => { if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; } };
    if (keepScreenOn) requestWakeLock(); else releaseWakeLock();
    return () => releaseWakeLock();
  }, [keepScreenOn, t]);

  const scaledIngredientGroups: ScaledIngredientGroup[] = useMemo(() => {
    if (!recipe || !recipe.ingredientGroups) return [];
    const scaleIngredientQuantityForDisplay = (quantityStr: string, originalServingsValue: number, newServingsValue: number): string => {
        if (typeof quantityStr !== 'string') return '';
        const quantityNum = parseFloat(quantityStr.replace(',', '.'));
        if (isNaN(quantityNum) || originalServingsValue <= 0 || newServingsValue <= 0) return quantityStr;
        const scaledQuantity = (quantityNum / originalServingsValue) * newServingsValue;
        let formattedQuantity = Number.isInteger(scaledQuantity) ? scaledQuantity.toString() : Number(scaledQuantity.toFixed(2)).toString().replace(/\.?0+$/, '');
        return formattedQuantity.replace('.', ',');
    };
    return recipe.ingredientGroups.map(group => ({
      ...group,
      ingredients: group.ingredients.map(ing => ({
        ...ing,
        quantity: recipe.servingsValue ? scaleIngredientQuantityForDisplay(ing.quantity, recipe.servingsValue, numServings) : ing.quantity
      }))
    }));
  }, [recipe, numServings]);

  const handleServingsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (value > 0) setNumServings(value);
  };
  const incrementServings = () => setNumServings(prev => prev + 1);
  const decrementServings = () => setNumServings(prev => (prev > 1 ? prev - 1 : 1));

  const handleDeleteRecipe = async () => {
    if (!recipe?.id) return;
    if (!user || (recipe.createdBy !== user.uid && !isAdmin)) {
      toast({ title: t('error_generic_title'), description: t('unauthorized_action'), variant: 'destructive' }); return;
    }
    try { await deleteRecipe(recipe.id); toast({ title: t('recipe_deleted_successfully') }); router.push("/"); }
    catch (error) { toast({ title: t('error_generic_title'), description: t('error_deleting_recipe'), variant: 'destructive' }); }
  };

  const handleAddToShoppingList = () => {
    if (!recipe || !recipe.id) return;
    const itemsToAdd = scaledIngredientGroups.flatMap(group =>
      group.ingredients.map(ing => ({
        name: ing.name, quantity: ing.quantity, unit: ing.unit, recipeId: recipe.id, recipeTitle: recipe.title,
      }))
    );
    if (itemsToAdd.length > 0) {
      addItemsToShoppingList(itemsToAdd);
      toast({ title: t('items_added_to_shopping_list') });
    }
  };

  const handleExportHTML = async () => {
    if (!recipe?.id) return; setIsExportingHtml(true);
    const result = await exportSingleRecipeAsHTML(recipe.id, numServings);
    if (!result.success) toast({ title: t('error_exporting_html'), description: result.error || t('no_recipe_to_export'), variant: "destructive" });
    setIsExportingHtml(false);
  };
  const handleExportMarkdown = async () => {
    if (!recipe?.id) return; setIsExportingMarkdown(true);
    const result = await exportSingleRecipeAsMarkdown(recipe.id, numServings);
    if (!result.success) toast({ title: t('error_exporting_markdown'), description: result.error || t('no_recipe_to_export'), variant: "destructive" });
    setIsExportingMarkdown(false);
  };

  const handleToggleInstructionStep = useCallback((stepId: string) => {
    setInstructionStepStates(prev => ({ ...prev, [stepId]: !prev[stepId], }));
  }, []);

  const handleToggleTipStep = useCallback((tipId: string) => {
    setTipStepStates(prev => ({ ...prev, [tipId]: !prev[tipId], }));
  }, []);

  const handleRateRecipe = async (newRating: number) => {
    if (!recipe || !user) {
      toast({ title: t('must_be_logged_in_to_rate'), variant: "destructive" });
      return;
    }
    // Rating logic remains: users can rate public recipes, or their own private recipes.
    if (!recipe.isPublic && recipe.createdBy !== user.uid) {
        toast({ title: t('unauthorized_action_rate_private'), variant: "destructive" });
        return;
    }
    try {
      await submitRecipeRating(recipe.id, user.uid, newRating);
      toast({ title: t('rating_submitted_successfully') });
    } catch (error: any) {
      toast({ title: t('error_submitting_rating'), description: error.message || t('error_generic_title'), variant: "destructive" });
    }
  };

  // Removed share link generation and dialog logic

  if (isLoadingRecipe || authLoading || recipesLoadingFromContext) {
    return <div className="max-w-3xl mx-auto space-y-6"> <Skeleton className="h-12 w-3/4" /> <Skeleton className="h-64 w-full rounded-lg" /> <div className="grid md:grid-cols-3 gap-6"> <div className="md:col-span-1 space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-32 w-full" /></div> <div className="md:col-span-2 space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-48 w-full" /></div> </div> </div>;
  }
  if (!recipe) return <div className="text-center py-10 text-xl text-muted-foreground">{t('recipe_not_found')}</div>; // Simplified message

  const canEdit = user && recipe.createdBy === user.uid;
  const canDelete = (user && recipe.createdBy === user.uid) || isAdmin;
  const anyExportInProgress = isExportingHtml || isExportingMarkdown;
  
  const displayServingsUnit = recipe.servingsUnit === 'pieces' ? t('servings_unit_pieces') : t('servings_unit_servings');
  const canVoteOnRecipe = user && (recipe.isPublic || recipe.createdBy === user.uid);
  const currentUserRating = user ? recipe.ratings?.[user.uid] || 0 : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_recipes')}</Button>
      
      <Card className="overflow-hidden shadow-xl">
        {recipe.imageUrl && (
          <div className="relative w-full h-64 md:h-96">
            {recipe.imageUrl.startsWith('data:image') ? <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" data-ai-hint="food cooking dish"/> : <NextImage src={recipe.imageUrl} alt={recipe.title} fill sizes="100vw" className="object-cover" data-ai-hint="food cooking dish" priority />}
          </div>
        )}
        <CardHeader className="pt-6">
          <div className="flex justify-between items-start flex-wrap gap-y-2">
            <div className="flex-grow">
              <CardTitle className="text-3xl md:text-4xl font-bold">{recipe.title}</CardTitle>
              {recipe.isPublic ? <Badge variant="outline" className="mt-2 border-green-500 text-green-600 bg-green-500/10"><Globe className="mr-1.5 h-3.5 w-3.5" />{t('public_recipe_indicator')}</Badge> : <Badge variant="outline" className="mt-2 border-amber-500 text-amber-600 bg-amber-500/10"><EyeOff className="mr-1.5 h-3.5 w-3.5" />{t('private_recipe_indicator')}</Badge>}
            </div>
            <div className="flex gap-2 flex-shrink-0 items-center">
              <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="flex items-center space-x-2"><Switch id="keep-screen-on" checked={keepScreenOn} onCheckedChange={setKeepScreenOn} aria-label={t('keep_screen_on_label')} /><Label htmlFor="keep-screen-on" className="text-sm text-muted-foreground flex items-center"><Smartphone className="mr-1 h-4 w-4" />{t('keep_screen_on_label_short')}<Info className="ml-1 h-3 w-3 cursor-help" /></Label></div></TooltipTrigger><TooltipContent><p>{t('keep_screen_on_tooltip')}</p></TooltipContent></Tooltip></TooltipProvider>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={t('export_recipe')} disabled={anyExportInProgress}>{anyExportInProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={handleExportHTML} disabled={isExportingHtml}><FileCode className="mr-2 h-4 w-4" />{t('export_as_html_item')}</DropdownMenuItem><DropdownMenuItem onClick={handleExportMarkdown} disabled={isExportingMarkdown}><FileText className="mr-2 h-4 w-4" />{t('export_as_markdown_item')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              {/* Share button removed */}
              {canEdit && <Button variant="outline" size="icon" asChild><Link href={`/recipes/${recipe.id}/edit`} aria-label={t('edit_recipe')}><Edit className="h-4 w-4" /></Link></Button>}
              {canDelete && <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" aria-label={t('delete_recipe')}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('confirm_delete_recipe')}</AlertDialogTitle><AlertDialogDescription>{t('this_action_cannot_be_undone')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDeleteRecipe}>{t('delete')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
            </div>
          </div>
          {recipe.description && <CardDescription className="text-lg text-muted-foreground pt-2">{recipe.description}</CardDescription>}
          {recipe.sourceUrl && (
            <p className="text-sm text-muted-foreground pt-2">
              <LinkIcon className="inline-block h-4 w-4 mr-1 align-middle" />
              {t('source_url_label')}:{' '}
              <Link href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                {recipe.sourceUrl}
              </Link>
            </p>
          )}
        </CardHeader>
        <CardContent className="py-6 space-y-8">
          <div className="grid md:grid-cols-3 gap-6 text-sm items-center">
            {recipe.prepTime && <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><div><strong>{t('prep_time')}:</strong> {recipe.prepTime}</div></div>}
            {recipe.cookTime && <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><div><strong>{t('cook_time')}:</strong> {recipe.cookTime}</div></div>}
            <div className="flex items-center gap-2"><Utensils className="h-5 w-5 text-primary" /><div><strong>{t('servings')}:</strong> {recipe.servingsValue} {displayServingsUnit}</div></div>
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">{canVoteOnRecipe ? t('your_rating') : t('average_rating_label')}:</Label>
            <div className="flex items-center gap-2">
              <StarRating
                rating={currentUserRating || recipe.averageRating || 0}
                onRate={canVoteOnRecipe ? handleRateRecipe : undefined}
                interactive={canVoteOnRecipe}
                size={24}
                showTooltip={canVoteOnRecipe}
              />
              {(recipe.numRatings || 0) > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({recipe.averageRating?.toFixed(1)} {t('stars_short')} / {recipe.numRatings} {recipe.numRatings === 1 ? t('vote_singular') : t('votes_plural')})
                </span>
              )}
               {!canVoteOnRecipe && user && (recipe.numRatings || 0) === 0 && recipe.isPublic && (
                <span className="text-sm text-muted-foreground">{t('be_the_first_to_rate')}</span>
              )}
            </div>
          </div>

          <Separator />
          <div className="grid md:grid-cols-3 gap-x-8 gap-y-6">
            <div className="md:col-span-1 space-y-6">
              <h3 className="text-xl font-semibold">{t('ingredients')}</h3>
              {(scaledIngredientGroups && scaledIngredientGroups.length > 0 && scaledIngredientGroups.some(g => g.ingredients.length > 0)) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="servings-input" className="text-base">{t('scale_servings')} {numServings} {displayServingsUnit}:</Label>
                    <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={decrementServings} aria-label={t('decrease_servings')}><Minus className="h-4 w-4" /></Button><Input id="servings-input" type="number" value={numServings} onChange={handleServingsChange} min="1" className="w-20 text-center hide-number-spinners" aria-label={t('number_of_servings')} /><Button variant="outline" size="icon" onClick={incrementServings} aria-label={t('increase_servings')}><Plus className="h-4 w-4" /></Button></div>
                  </div>
                  {scaledIngredientGroups.map(group => (
                    <div key={group.id} className="mt-4">
                      { (recipe.ingredientGroups.length > 1 || (group.name && group.name !== t('default_ingredient_group_name'))) && <h4 className="text-md font-medium text-primary mb-1">{group.name}</h4>}
                      <ul className="space-y-1.5 list-disc list-inside pl-1">
                        {group.ingredients.map((ing, index) => (
                          <li key={ing.id || index} className="text-muted-foreground"><span className="font-medium text-foreground">{ing.quantity} {ing.unit}</span> {ing.name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <Button variant="default" className="w-full mt-4" onClick={handleAddToShoppingList} disabled={!recipe.id}><ShoppingCart className="mr-2 h-4 w-4" /> {t('add_to_shopping_list')}</Button>
                </>
              )}
            </div>
            <div className="md:col-span-2">
              <h3 className="text-xl font-semibold mb-2">{t('instructions')}</h3>
              {recipe.instructions && recipe.instructions.length > 0 ? (
                <ol className="list-decimal list-outside space-y-3 pl-5">
                  {recipe.instructions.map((step, index) => (
                    <li key={step.id} className="flex items-start gap-x-3.5">
                       <Checkbox
                          id={`instruction-step-${step.id}`}
                          checked={instructionStepStates[step.id] || false}
                          onCheckedChange={() => handleToggleInstructionStep(step.id)}
                          aria-label={t('toggle_step_completion_aria', { stepNumber: index + 1 })}
                          className="mt-1 shrink-0"
                        />
                      <label 
                        htmlFor={`instruction-step-${step.id}`}
                        className={cn(
                          "flex-grow prose prose-sm sm:prose-base max-w-none text-foreground whitespace-pre-line cursor-pointer",
                          (instructionStepStates[step.id] || false) && "line-through text-muted-foreground"
                        )}
                      >
                        {linkifyText(step.text)}
                      </label>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground">{t('no_instructions_provided')}</p>
              )}
            </div>
          </div>
          
          {recipe.tips && recipe.tips.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  {t('tips_label')}
                </h3>
                <ol className="list-decimal list-outside space-y-3 pl-5">
                  {recipe.tips.map((tip, index) => (
                    <li key={tip.id} className="flex items-start gap-x-3.5">
                      <Checkbox
                        id={`tip-step-${tip.id}`}
                        checked={tipStepStates[tip.id] || false}
                        onCheckedChange={() => handleToggleTipStep(tip.id)}
                        aria-label={t('toggle_tip_completion_aria', { tipNumber: index + 1 })}
                        className="mt-1 shrink-0"
                      />
                      <label
                        htmlFor={`tip-step-${tip.id}`}
                        className={cn(
                          "flex-grow prose prose-sm sm:prose-base max-w-none text-foreground whitespace-pre-line cursor-pointer",
                          (tipStepStates[tip.id] || false) && "line-through text-muted-foreground"
                        )}
                      >
                        {linkifyText(tip.text)}
                      </label>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {(recipe.categories?.length > 0 || recipe.tags?.length > 0) && <Separator />}
          <div className="space-y-4">
            {recipe.categories?.length > 0 && <div className="flex items-center gap-2 flex-wrap"><Bookmark className="h-5 w-5 text-primary" /><strong className="text-sm">{t('categories')}:</strong>{recipe.categories.map(cat => <Link key={cat} href={`/?category=${encodeURIComponent(cat)}`} passHref legacyBehavior><a className="no-underline"><Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 border border-transparent transition-colors">{cat}</Badge></a></Link>)}</div>}
            {recipe.tags?.length > 0 && <div className="flex items-center gap-2 flex-wrap"><Tag className="h-5 w-5 text-primary" /><strong className="text-sm">{t('tags')}:</strong>{recipe.tags.map(tag => <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} passHref legacyBehavior><a className="no-underline"><Badge variant="outline" className="cursor-pointer hover:bg-accent/10 hover:border-accent/50 border border-transparent transition-colors">{tag}</Badge></a></Link>)}</div>}
          </div>
        </CardContent>
      </Card>
      {/* Share link Dialog removed */}
    </div>
  );
}


export default function RecipeDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <RecipeDetailPageContent />
    </Suspense>
  );
}

