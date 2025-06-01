
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRecipes } from "@/contexts/RecipeContext";
import type { Recipe as RecipeType } from "@/types";
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
import { Clock, Users, Tag, Bookmark, Edit, Trash2, ShoppingCart, Minus, Plus, ArrowLeft, Globe, EyeOff, FileText, FileCode, Loader2 } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";


const scaleIngredientQuantity = (quantityStr: string, originalServings: number, newServings: number): string => {
  if (typeof quantityStr !== 'string') return '';
  const quantityNum = parseFloat(quantityStr.replace(',', '.'));
  if (isNaN(quantityNum) || originalServings <= 0 || newServings <= 0) {
    return quantityStr;
  }
  const scaledQuantity = (quantityNum / originalServings) * newServings;
  
  let formattedQuantity: string;
  if (Number.isInteger(scaledQuantity)) {
    formattedQuantity = scaledQuantity.toString();
  } else {
    let tempFormatted = Number(scaledQuantity.toFixed(2)).toString();
    if (tempFormatted.includes('.')) {
        tempFormatted = tempFormatted.replace(/\.?0+$/, '');
    }
    formattedQuantity = tempFormatted;
  }
  return formattedQuantity.replace('.', ',');
};


export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;
  
  const { getRecipeById, deleteRecipe, exportSingleRecipeAsHTML, exportSingleRecipeAsMarkdown, loading: recipesLoading } = useRecipes();
  const { user, isAdmin, loading: authLoading } = useAuth(); 
  const { addMultipleItems: addItemsToShoppingList } = useShoppingList();
  const { t } = useTranslation();
  
  const [recipe, setRecipe] = useState<RecipeType | null | undefined>(undefined);
  const [numServings, setNumServings] = useState(1);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [isExportingMarkdown, setIsExportingMarkdown] = useState(false);

  useEffect(() => {
    if (recipeId && !recipesLoading) {
      const foundRecipe = getRecipeById(recipeId);
      setRecipe(foundRecipe);
      if (foundRecipe && typeof foundRecipe.servings === 'number') {
        setNumServings(foundRecipe.servings);
      } else if (foundRecipe) {
        setNumServings(1);
      }
    }
  }, [recipeId, getRecipeById, recipesLoading]);
  
  const scaledIngredients = useMemo(() => {
    if (!recipe || !recipe.ingredients) return [];
    return recipe.ingredients.map(ing => ({
      ...ing,
      quantity: recipe.servings ? scaleIngredientQuantity(ing.quantity, recipe.servings, numServings) : ing.quantity
    }));
  }, [recipe, numServings]);

  const handleServingsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (value > 0) {
      setNumServings(value);
    }
  };

  const incrementServings = () => setNumServings(prev => prev + 1);
  const decrementServings = () => setNumServings(prev => (prev > 1 ? prev - 1 : 1));

  const handleDeleteRecipe = async () => {
    if (recipe && recipe.id) {
      if ((user && recipe.createdBy === user.uid) || isAdmin) {
        try {
          await deleteRecipe(recipe.id);
          toast({ title: t('recipe_deleted_successfully') }); 
          router.push("/");
        } catch (error) {
          toast({ title: t('error_generic_title'), description: t('error_deleting_recipe'), variant: 'destructive' });
          console.error("Error deleting recipe:", error);
        }
      } else {
        toast({ title: t('error_generic_title'), description: t('unauthorized_action'), variant: 'destructive' }); 
      }
    }
  };

  const handleAddToShoppingList = () => {
    if (!recipe || !recipe.id) return;
    const itemsToAdd = scaledIngredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
    }));
    addItemsToShoppingList(itemsToAdd);
    toast({ title: t('items_added_to_shopping_list') });
  };

  const handleExportHTML = async () => {
    if (!recipe || !recipe.id) return;
    setIsExportingHtml(true);
    const result = await exportSingleRecipeAsHTML(recipe.id);
    if (result.success) {
      toast({ title: t('recipe_exported_html_successfully') });
    } else {
      toast({ title: t('error_exporting_html'), description: result.error || t('no_recipe_to_export'), variant: "destructive" });
    }
    setIsExportingHtml(false);
  };

  const handleExportMarkdown = async () => {
    if (!recipe || !recipe.id) return;
    setIsExportingMarkdown(true);
    const result = await exportSingleRecipeAsMarkdown(recipe.id);
    if (result.success) {
      toast({ title: t('recipe_exported_markdown_successfully') });
    } else {
      toast({ title: t('error_exporting_markdown'), description: result.error || t('no_recipe_to_export'), variant: "destructive" });
    }
    setIsExportingMarkdown(false);
  };

  if (recipesLoading || authLoading || recipe === undefined) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return <div className="text-center py-10 text-xl text-muted-foreground">{t('recipe_not_found')}</div>;
  }
  
  const isOwner = user && recipe.createdBy === user.uid;
  const canEdit = isOwner; 
  const canDelete = isOwner || isAdmin; 
  const anyExportInProgress = isExportingHtml || isExportingMarkdown;

  const isDataUrl = recipe.imageUrl && recipe.imageUrl.startsWith('data:image');

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_recipes')}
      </Button>
      <Card className="overflow-hidden shadow-xl">
        {recipe.imageUrl && (
          <div className="relative w-full h-64 md:h-96">
            {isDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={recipe.imageUrl} 
                alt={recipe.title} 
                className="w-full h-full object-cover"
                data-ai-hint="food cooking dish"
              />
            ) : (
              <NextImage 
                src={recipe.imageUrl} 
                alt={recipe.title} 
                layout="fill" 
                objectFit="cover" 
                data-ai-hint="food cooking dish"
                priority
              />
            )}
          </div>
        )}
        <CardHeader className="pt-6">
          <div className="flex justify-between items-start flex-wrap gap-y-2">
            <div className="flex-grow">
                <CardTitle className="text-3xl md:text-4xl font-bold">{recipe.title}</CardTitle>
                {recipe.isPublic ? (
                    <Badge variant="outline" className="mt-2 border-green-500 text-green-600 bg-green-500/10">
                        <Globe className="mr-1.5 h-3.5 w-3.5" />{t('public_recipe_indicator')}
                    </Badge>
                ) : (
                    <Badge variant="outline" className="mt-2 border-amber-500 text-amber-600 bg-amber-500/10">
                        <EyeOff className="mr-1.5 h-3.5 w-3.5" />{t('private_recipe_indicator')}
                    </Badge>
                )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handleExportHTML} disabled={anyExportInProgress}>
                  {isExportingHtml ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCode className="mr-2 h-4 w-4" />}
                  {t('export_as_html')}
                </Button>
                 <Button variant="outline" size="sm" onClick={handleExportMarkdown} disabled={anyExportInProgress}>
                  {isExportingMarkdown ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  {t('export_as_markdown')}
                </Button>
                {canEdit && (
                    <Button variant="outline" size="icon" asChild>
                        <Link href={`/recipes/${recipe.id}/edit`} aria-label={t('edit_recipe')}>
                        <Edit className="h-4 w-4" />
                        </Link>
                    </Button>
                )}
                {canDelete && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" aria-label={t('delete_recipe')}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('confirm_delete_recipe')}</AlertDialogTitle>
                            <AlertDialogDescription>
                            {t('this_action_cannot_be_undone')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteRecipe}>{t('delete')}</AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
             </div>
          </div>
          {recipe.description && <CardDescription className="text-lg text-muted-foreground pt-2">{recipe.description}</CardDescription>}
        </CardHeader>
        
        <CardContent className="py-6 space-y-8">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            {recipe.prepTime && <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><div><strong>{t('prep_time')}:</strong> {recipe.prepTime}</div></div>}
            {recipe.cookTime && <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><div><strong>{t('cook_time')}:</strong> {recipe.cookTime}</div></div>}
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><div><strong>{t('servings')}:</strong> {recipe.servings || 1}</div></div>
          </div>

          <Separator />

          <div className="grid md:grid-cols-3 gap-x-8 gap-y-6">
            <div className="md:col-span-1 space-y-6">
              <h3 className="text-xl font-semibold">{t('ingredients')}</h3>
              {(recipe.ingredients && recipe.ingredients.length > 0) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="servings-input" className="text-base">{t('scale_servings')}:</Label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={decrementServings} aria-label={t('decrease_servings')}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="servings-input"
                        type="number"
                        value={numServings}
                        onChange={handleServingsChange}
                        min="1"
                        className="w-20 text-center hide-number-spinners"
                        aria-label={t('number_of_servings')}
                      />
                      <Button variant="outline" size="icon" onClick={incrementServings} aria-label={t('increase_servings')}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <ul className="space-y-2 list-disc list-inside pl-1">
                    {scaledIngredients.map((ing, index) => (
                      <li key={ing.id || index} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{ing.quantity} {ing.unit}</span> {ing.name}
                      </li>
                    ))}
                  </ul>
                  <Button variant="default" className="w-full mt-4" onClick={handleAddToShoppingList} disabled={!recipe.id}>
                    <ShoppingCart className="mr-2 h-4 w-4" /> {t('add_to_shopping_list')}
                  </Button>
                </>
              )}
            </div>

            <div className="md:col-span-2">
              <h3 className="text-xl font-semibold mb-2">{t('instructions')}</h3>
              <div className="prose prose-sm sm:prose-base max-w-none text-foreground whitespace-pre-line">
                {recipe.instructions}
              </div>
            </div>
          </div>
          
          {(recipe.tags?.length > 0 || recipe.categories?.length > 0) && <Separator />}

          <div className="space-y-4">
            {recipe.categories?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Bookmark className="h-5 w-5 text-primary" />
                <strong className="text-sm">{t('categories')}:</strong>
                {recipe.categories.map((cat) => (
                  <Link key={cat} href={`/?category=${encodeURIComponent(cat)}`} passHref legacyBehavior>
                    <a className="no-underline">
                      <Badge variant="secondary" className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 border border-transparent transition-colors">
                        {cat}
                      </Badge>
                    </a>
                  </Link>
                ))}
              </div>
            )}
            {recipe.tags?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-5 w-5 text-primary" />
                <strong className="text-sm">{t('tags')}:</strong>
                {recipe.tags.map((tag) => (
                   <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} passHref legacyBehavior>
                    <a className="no-underline">
                      <Badge variant="outline" className="cursor-pointer hover:bg-accent/10 hover:border-accent/50 border border-transparent transition-colors">
                        {tag}
                      </Badge>
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
