
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Recipe } from "@/types";
import { useRecipes } from "@/contexts/RecipeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { IngredientField } from "./IngredientField";
import { useTranslation } from "@/lib/i18n";
import { suggestRecipeImage } from "@/ai/flows/suggest-recipe-image";
import NextImage from "next/image";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Eye, EyeOff } from "lucide-react"; // Added Eye, EyeOff
import { Switch } from "@/components/ui/switch"; // Added Switch import
import { Label as SwitchLabel } from "@/components/ui/label"; // For the switch label
import { v4 as uuidv4 } from "uuid";
import { DragDropContext, Droppable, Draggable, type DropResult, type ResponderProvided, type DragStart } from '@hello-pangea/dnd';

const ingredientSchema = z.object({
  id: z.string().optional(),
  fieldId: z.string().optional(), // from useFieldArray
  name: z.string().min(1, "ingredient_name_required"),
  quantity: z.string().min(1, "quantity_required"),
  unit: z.string().min(1, "unit_required"),
});

const recipeFormSchema = z.object({
  title: z.string().min(3, "title_min_length"),
  description: z.string().optional(),
  ingredients: z.array(ingredientSchema).min(1, "ingredients_min_length"),
  instructions: z.string().min(10, "instructions_min_length"),
  tags: z.string().transform(val => val.split(',').map(tag => tag.trim()).filter(tag => tag !== "")).optional(),
  categories: z.string().transform(val => val.split(',').map(cat => cat.trim()).filter(cat => cat !== "")).optional(),
  servings: z.coerce.number().min(1, "servings_min_value"),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  imageUrl: z.string().optional(),
  isPublic: z.boolean().default(false).optional(), // Added isPublic
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;

interface RecipeFormProps {
  initialData?: Recipe;
  isEditMode?: boolean;
}

const MAX_IMAGE_WIDTH = 800;
const IMAGE_QUALITY = 0.7;

async function resizeDataUri(dataUri: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error("Failed to get canvas context"));
      }
      ctx.drawImage(img, 0, 0, width, height);
      const resizedDataUri = canvas.toDataURL('image/jpeg', quality);
      resolve(resizedDataUri);
    };
    img.onerror = (err) => {
      console.error("Error loading image for resizing:", err);
      reject(new Error("Failed to load image for resizing."));
    };
    img.src = dataUri;
  });
}


export function RecipeForm({ initialData, isEditMode = false }: RecipeFormProps) {
  const router = useRouter();
  const { addRecipe, updateRecipe } = useRecipes();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageSuggestionLoading, setImageSuggestionLoading] = useState(false);
  const [currentImageUrlPreview, setCurrentImageUrlPreview] = useState<string | undefined>(initialData?.imageUrl);


  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          tags: initialData.tags?.join(", ") || "",
          categories: initialData.categories?.join(", ") || "",
          ingredients: initialData.ingredients.map(ing => ({
            ...ing,
            id: ing.id || uuidv4(),
            fieldId: uuidv4(), 
            quantity: String(ing.quantity),
            unit: String(ing.unit),
          })),
          imageUrl: initialData.imageUrl || "",
          isPublic: initialData.isPublic || false, // Initialize isPublic
        }
      : {
          title: "",
          description: "",
          ingredients: [{ id: uuidv4(), fieldId: uuidv4(), name: "", quantity: "", unit: "" }],
          instructions: "",
          tags: "",
          categories: "",
          servings: 4,
          prepTime: "",
          cookTime: "",
          imageUrl: "",
          isPublic: false, // Default for new recipes
        },
  });

  useEffect(() => {
    if (initialData?.imageUrl) {
        setCurrentImageUrlPreview(initialData.imageUrl);
    }
    if (initialData) { // Ensure isPublic is set from initialData if editing
        form.setValue('isPublic', initialData.isPublic || false);
    }
  }, [initialData, form]);


  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "ingredients",
    keyName: "fieldId" 
  });
  
  const onDragStart = (start: DragStart, provided: ResponderProvided) => {
    console.log('DRAG STARTED (RecipeForm):', start);
    console.log('Draggable ID:', start.draggableId, 'Source Index:', start.source.index);
    const fieldsAtDragStart = form.getValues().ingredients.map(f => ({ fieldId: f.fieldId || 'undefined', name: f.name, originalRHFIndex: fields.findIndex(rhfField => rhfField.fieldId === f.fieldId) }));
    console.log('Current RHF `fields` at drag start (fieldId, name, originalRHFIndex):', fieldsAtDragStart);
  };
  
  const onDragEnd = (result: DropResult) => {
    console.log('ON DRAG END CALLED (RecipeForm). Result:', result);
  
    if (!result.destination) {
      console.log('No destination, exiting onDragEnd.');
      return;
    }
    if (result.destination.index === result.source.index) {
      console.log('Source and destination are the same, exiting onDragEnd.');
      return;
    }
    
    console.log(`DRAG ENDED. Source index: ${result.source.index}, Destination index: ${result.destination.index}, Draggable ID (should be fieldId): ${result.draggableId}`);
    
    const fieldsFromHook = fields.map((f, idx) => ({ fieldId: f.fieldId, name: f.name, hookIndex: idx }));
    const fieldsFromFormValues = form.getValues().ingredients.map((ing, idx) => ({ fieldId: ing.fieldId, name: ing.name, formValueIndex: idx }));
    console.log('Current RHF `fields` (from useFieldArray) at start of onDragEnd:', fieldsFromHook);
    console.log('Current ingredients in form values at start of onDragEnd:', fieldsFromFormValues);

    const draggableExistsInFields = fields.some(field => field.fieldId === result.draggableId);
    if (!draggableExistsInFields) {
      console.error(`CRITICAL: Draggable ID "${result.draggableId}" from DND was NOT FOUND in the current react-hook-form \`fields\` array (from useFieldArray) before move. This is the primary reason for failure.`);
      toast({
        title: t("error_generic_title"),
        description: t("error_reorder_ingredient_find_critical"),
        variant: "destructive",
      });
      return;
    }
  
    if (fields[result.source.index]?.fieldId !== result.draggableId) {
        console.warn(`Potential Mismatch: RHF field at source index ${result.source.index} (fieldId: ${fields[result.source.index]?.fieldId}) does not match reported draggableId ${result.draggableId}. This might not be an error if DND is internally consistent, but worth noting.`);
    }
    
    console.log(`Attempting to move ingredient in RHF from index ${result.source.index} to ${result.destination.index} (Draggable ID: ${result.draggableId}) via setTimeout.`);
    
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        console.log('Inside setTimeout: Preparing to call move().');
        try {
          move(result.source.index, result.destination.index);
          console.log('RHF `move` operation called successfully via setTimeout.');
          console.log('Ingredient data order after move (from form.getValues()):', form.getValues().ingredients.map(ing => ({name: ing.name, fieldId: ing.fieldId}) ));
          toast({ title: t('ingredients_reordered')});
        } catch (error) {
            console.error("Error during RHF `move` operation inside setTimeout:", error);
            toast({
              title: t("error_generic_title"),
              description: t("error_reorder_ingredient_move_failed"),
              variant: "destructive",
            });
        }
      }, 0);
    }
  };

  const handleSuggestImage = async () => {
    const title = form.getValues("title");
    if (!title) {
      toast({ title: t("recipe_title_needed_for_image"), variant: "destructive" });
      return;
    }
    setImageSuggestionLoading(true);
    setCurrentImageUrlPreview(undefined);
    form.setValue("imageUrl", "");

    try {
      const result = await suggestRecipeImage({ recipeTitle: title });
      if (result.imageUri) {
        if (result.imageUri.length > 700000) { 
            console.warn(`AI-generated image for "${title}" is very large (length: ${result.imageUri.length}). Attempting to resize.`);
        }
        toast({ title: t("image_processing_toast_title"), description: t("image_processing_toast_desc") });
        const resizedImageUri = await resizeDataUri(result.imageUri, MAX_IMAGE_WIDTH, IMAGE_QUALITY);

        console.log(`Original image URI length: ${result.imageUri.length}, Resized: ${resizedImageUri.length}`);
        if (resizedImageUri.length > 1048487 * 0.9) { 
            console.error("Resized image is still potentially too large for Firestore:", resizedImageUri.length);
            toast({ title: t("image_suggestion_error"), description: t("image_still_too_large_error"), variant: "destructive" });
            setCurrentImageUrlPreview(undefined);
            form.setValue("imageUrl", "");
        } else {
            setCurrentImageUrlPreview(resizedImageUri);
            form.setValue("imageUrl", resizedImageUri, { shouldValidate: true, shouldDirty: true });
            toast({ title: t("image_suggestion_success") });
        }
      } else {
        toast({ title: t("image_suggestion_no_result"), variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error suggesting or resizing image:", error);
      const errorMessage = error.message || t("error_generic_title");
      if (errorMessage.includes("longer than 1048487 bytes") || errorMessage.includes("Resized image is still potentially too large")) {
          toast({ title: t("image_suggestion_error"), description: t("image_still_too_large_error"), variant: "destructive" });
      } else if (errorMessage.includes("AI did not return a valid data URI")) {
          toast({ title: t("image_suggestion_error"), description: t("image_suggestion_no_result"), variant: "destructive" });
      } else {
          toast({ title: t("image_suggestion_error"), description: errorMessage, variant: "destructive" });
      }
    } finally {
      setImageSuggestionLoading(false);
    }
  };

  const onSubmit = async (data: RecipeFormValues) => {
    if (!user) {
      toast({ title: t("must_be_logged_in"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const ingredientsForPayload = data.ingredients.map(ing => ({
        id: ing.id || uuidv4(),
        name: ing.name,
        quantity: String(ing.quantity),
        unit: String(ing.unit),
    }));

    const recipePayloadBase = {
      ...data,
      ingredients: ingredientsForPayload,
      isPublic: data.isPublic || false, // Ensure isPublic is set
      tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === 'string' ? data.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== "") : []),
      categories: Array.isArray(data.categories) ? data.categories : (typeof data.categories === 'string' ? data.categories.split(',').map(cat => cat.trim()).filter(cat => cat !== "") : []),
      createdBy: initialData?.createdBy || user.uid,
    };

    try {
      if (isEditMode && initialData?.id) {
        const updatedRecipeData: Recipe = {
            ...initialData,
            ...recipePayloadBase,
            id: initialData.id,
            updatedAt: new Date().toISOString(),
            createdAt: initialData.createdAt || new Date().toISOString(), 
        };
        await updateRecipe(updatedRecipeData);
        toast({ title: t('recipe_updated_successfully') });
        router.push(`/recipes/${initialData.id}`);
      } else {
         const newRecipeDataForAdd = {
          title: recipePayloadBase.title,
          description: recipePayloadBase.description,
          ingredients: recipePayloadBase.ingredients,
          instructions: recipePayloadBase.instructions,
          tags: recipePayloadBase.tags,
          categories: recipePayloadBase.categories,
          servings: recipePayloadBase.servings,
          prepTime: recipePayloadBase.prepTime,
          cookTime: recipePayloadBase.cookTime,
          imageUrl: recipePayloadBase.imageUrl,
          isPublic: recipePayloadBase.isPublic, // Pass isPublic
          createdBy: user.uid,
        };
        const newRecipe = await addRecipe(newRecipeDataForAdd as Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>);
        toast({ title: t('recipe_added_successfully') });
        router.push(`/recipes/${newRecipe.id}`);
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      const errorMessage = (error as Error).message || t('error_generic_title');
      if (errorMessage.includes("longer than 1048487 bytes")) {
        toast({ title: t('error_saving_recipe'), description: t('image_still_too_large_error'), variant: "destructive" });
      } else {
        toast({ title: t('error_saving_recipe'), description: errorMessage, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false); // Corrected from true to false
    }
  };

  const translateError = (messageKey?: string) => {
    if (!messageKey) return undefined;
    if (messageKey && !messageKey.includes(" ") && !messageKey.includes(".")) {
         const translated = t(messageKey);
         return translated === messageKey ? messageKey : translated;
    }
    return messageKey;
  }

  const watchedImageUrl = form.watch("imageUrl");
  const displayImageUrl = currentImageUrlPreview || watchedImageUrl;
  const isDisplayImageValidUrl = displayImageUrl && (displayImageUrl.startsWith('http://') || displayImageUrl.startsWith('https://'));
  const isDisplayImageDataUrl = displayImageUrl && displayImageUrl.startsWith('data:image');


  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          {isEditMode ? t('edit_recipe') : t('add_recipe')}
        </CardTitle>
        <ShadcnCardDescription>{t('fill_recipe_details')}</ShadcnCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('recipe_title')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('recipe_title_placeholder')} {...field} />
                  </FormControl>
                  <FormMessage>{translateError(form.formState.errors.title?.message)}</FormMessage>
                </FormItem>
              )}
            />

            {(displayImageUrl || imageSuggestionLoading) && (
              <div className="space-y-2">
                <FormLabel>{t('current_image_label')}</FormLabel>
                {imageSuggestionLoading ? (
                  <div className="flex items-center justify-center h-48 w-full rounded-md border border-dashed bg-muted/50">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isDisplayImageDataUrl ? (
                   // eslint-disable-next-line @next/next/no-img-element
                   <img
                    src={displayImageUrl}
                    alt={form.getValues("title") || t('suggested_image')}
                    className="rounded-md object-cover border w-full aspect-[16/9]"
                    data-ai-hint="food cooking recipe"
                  />
                ) : isDisplayImageValidUrl ? (
                  <NextImage
                    src={displayImageUrl}
                    alt={form.getValues("title") || t('suggested_image')}
                    width={MAX_IMAGE_WIDTH}
                    height={MAX_IMAGE_WIDTH * 9 / 16}
                    className="rounded-md object-cover border w-full aspect-[16/9]"
                    data-ai-hint="food cooking recipe"
                    priority={isEditMode}
                  />
                ) : null}
              </div>
            )}
             <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t('image_url_optional')}</FormLabel>
                        <FormControl>
                            <Input
                                placeholder={t('image_url_placeholder')}
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(value);
                                    setCurrentImageUrlPreview(undefined); 
                                }}
                            />
                        </FormControl>
                        <FormDescription>{t('manual_image_url_desc')}</FormDescription>
                        <FormMessage>{translateError(form.formState.errors.imageUrl?.message)}</FormMessage>
                    </FormItem>
                )}
            />


            <Button type="button" onClick={handleSuggestImage} disabled={imageSuggestionLoading || isSubmitting || !form.watch('title')} variant="outline">
              {imageSuggestionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {t('suggest_image')}
            </Button>


            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('description_placeholder')} {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage>{translateError(form.formState.errors.description?.message)}</FormMessage>
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel className="text-base font-semibold">{t('ingredients')}</FormLabel>
              {fields.length > 0 && (
                 <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 gap-y-1 px-2 items-end mb-1">
                    <div /> 
                    <p className="text-xs text-muted-foreground font-medium">{t('ingredient_name')}</p>
                    <p className="text-xs text-muted-foreground font-medium">{t('quantity')}</p>
                    <p className="text-xs text-muted-foreground font-medium">{t('unit')}</p>
                    <div /> 
                </div>
              )}
              
              
                <DragDropContext
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                >
                  <Droppable 
                    droppableId="ingredientsDroppable" 
                    type="INGREDIENT"
                    isDropDisabled={false} 
                    isCombineEnabled={false} 
                    ignoreContainerClipping={false}
                  >
                    {(provided, snapshot) => ( 
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`mt-1 space-y-2 rounded-md ${snapshot.isDraggingOver ? 'bg-primary/10' : ''}`} 
                      >
                        {fields.map((item, index) => {
                          return (
                            <Draggable key={item.fieldId} draggableId={item.fieldId!} index={index} type="INGREDIENT"> 
                              {(providedDraggable, snapshotDraggable) => ( 
                                <IngredientField
                                  ref={providedDraggable.innerRef} 
                                  control={form.control as Control<RecipeFormValues>}
                                  index={index}
                                  remove={remove}
                                  isDragging={snapshotDraggable.isDragging} 
                                  draggableProps={providedDraggable.draggableProps}
                                  dragHandleProps={providedDraggable.dragHandleProps}
                                />
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              
               {(form.formState.errors.ingredients && (form.formState.errors.ingredients.message || (form.formState.errors.ingredients.root && form.formState.errors.ingredients.root.message))) && (
                <p className="text-sm font-medium text-destructive mt-1">
                    {translateError(form.formState.errors.ingredients.message || (form.formState.errors.ingredients.root && form.formState.errors.ingredients.root.message))}
                </p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ id: uuidv4(), fieldId: uuidv4(), name: "", quantity: "", unit: "" })} className="mt-2">
                {t('add_ingredient')}
              </Button>
            </div>

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('instructions')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('instructions_placeholder')} {...field} value={field.value || ''} rows={6} />
                  </FormControl>
                  <FormMessage>{translateError(form.formState.errors.instructions?.message)}</FormMessage>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="servings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('servings')}</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="4" {...field} />
                    </FormControl>
                    <FormMessage>{translateError(form.formState.errors.servings?.message)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('categories')} ({t('comma_separated')})</FormLabel>
                    <FormControl>
                      <Input placeholder={t('categories_placeholder')} {...field} value={field.value || ''}/>
                    </FormControl>
                    <FormMessage>{translateError(form.formState.errors.categories?.message)}</FormMessage>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tags')} ({t('comma_separated')})</FormLabel>
                    <FormControl>
                      <Input placeholder={t('tags_placeholder')} {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage>{translateError(form.formState.errors.tags?.message)}</FormMessage>
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-2 md:mt-0 col-span-1 md:col-span-1">
                    <div className="space-y-0.5">
                      <FormLabel>{t('make_recipe_public')}</FormLabel>
                      <FormDescription>
                        {field.value ? <Eye className="h-4 w-4 inline mr-1"/> : <EyeOff className="h-4 w-4 inline mr-1"/>}
                        {t('recipe_public_description')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="prepTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('prep_time')}</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 30 mins" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage>{translateError(form.formState.errors.prepTime?.message)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cookTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('cook_time')}</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 1 hour" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage>{translateError(form.formState.errors.cookTime?.message)}</FormMessage>
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={isSubmitting || imageSuggestionLoading} className="w-full sm:w-auto">
              {(isSubmitting || imageSuggestionLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? t('save_changes') : t('add_recipe')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
