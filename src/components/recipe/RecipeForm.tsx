
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Recipe, IngredientGroup, Ingredient, InstructionStep, TipStep, ServingsUnit } from "@/types";
import { useRecipes } from "@/contexts/RecipeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IngredientField } from "./IngredientField";
import { InstructionStepField } from "./InstructionStepField";
import { TipStepField } from "./TipStepField";
import { useTranslation } from "@/lib/i18n";
import { suggestRecipeImage } from "@/ai/flows/suggest-recipe-image";
import NextImage from "next/image";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Eye, EyeOff, PlusCircle, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from "uuid";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

const ingredientSchema = z.object({
  id: z.string().optional(),
  fieldId: z.string().optional(),
  name: z.string().min(1, "ingredient_name_required"),
  quantity: z.string().optional(), 
  unit: z.string().optional(),     
});

const ingredientGroupSchema = z.object({
  id: z.string().optional(),
  fieldId: z.string().optional(),
  name: z.string().optional(), // Made group name optional
  ingredients: z.array(ingredientSchema).min(1, "group_ingredients_min_length"),
});

const instructionStepSchema = z.object({
  id: z.string().optional(),
  fieldId: z.string().optional(),
  text: z.string().min(1, "instruction_step_text_required"),
  isChecked: z.boolean().default(false).optional(),
});

const tipStepSchema = z.object({
  id: z.string().optional(),
  fieldId: z.string().optional(),
  text: z.string().min(1, "tip_step_text_required"),
  isChecked: z.boolean().default(false).optional(),
});

const recipeFormSchemaFactory = (t: (key: string) => string) => z.object({
  title: z.string().min(3, "title_min_length"),
  description: z.string().optional(),
  ingredientGroups: z.array(ingredientGroupSchema).min(1, "ingredient_groups_min_length"),
  instructions: z.array(instructionStepSchema).min(1, "instructions_min_length_array"),
  tips: z.array(tipStepSchema).optional(),
  tags: z.string().transform(val => val.split(',').map(tag => tag.trim()).filter(tag => tag !== "")).optional(),
  categories: z.string().transform(val => val.split(',').map(cat => cat.trim()).filter(cat => cat !== "")).optional(),
  servingsValue: z.coerce.number().min(1, "servings_min_value"),
  servingsUnit: z.enum(['servings', 'pieces'], { errorMap: () => ({ message: t("servings_unit_required") }) }),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  imageUrl: z.string().optional(),
  isPublic: z.boolean().default(false).optional(),
});

export type RecipeFormValues = z.infer<ReturnType<typeof recipeFormSchemaFactory>>;

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
      if (!ctx) return reject(new Error("Failed to get canvas context"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(new Error("Failed to load image for resizing."));
    img.src = dataUri;
  });
}

const defaultIngredientGroup = (t: (key: string) => string): IngredientGroup => ({
  id: uuidv4(),
  fieldId: uuidv4(),
  name: "", 
  ingredients: [{ id: uuidv4(), fieldId: uuidv4(), name: "", quantity: "", unit: "" }],
});

const defaultInstructionStep = (): InstructionStep => ({
  id: uuidv4(),
  fieldId: uuidv4(),
  text: "",
  isChecked: false,
});

const defaultTipStep = (): TipStep => ({
  id: uuidv4(),
  fieldId: uuidv4(),
  text: "",
  isChecked: false,
});

export function RecipeForm({ initialData, isEditMode = false }: RecipeFormProps) {
  const router = useRouter();
  const { addRecipe, updateRecipe } = useRecipes();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageSuggestionLoading, setImageSuggestionLoading] = useState(false);
  const [currentImageUrlPreview, setCurrentImageUrlPreview] = useState<string | undefined>(initialData?.imageUrl);

  const currentRecipeFormSchema = recipeFormSchemaFactory(t);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(currentRecipeFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          servingsValue: initialData.servingsValue || (initialData as any).servings || 1, 
          servingsUnit: initialData.servingsUnit || 'servings',
          tags: initialData.tags?.join(", ") || "",
          categories: initialData.categories?.join(", ") || "",
          ingredientGroups: Array.isArray(initialData.ingredientGroups) && initialData.ingredientGroups.length > 0
            ? initialData.ingredientGroups.map(group => ({
                ...group,
                id: group.id || uuidv4(),
                fieldId: group.fieldId || uuidv4(),
                name: group.name || "", // Default to empty string if not present
                ingredients: Array.isArray(group.ingredients) ? group.ingredients.map(ing => ({
                  ...ing,
                  id: ing.id || uuidv4(),
                  fieldId: ing.fieldId || uuidv4(),
                  quantity: String(ing.quantity || ""), // Default to empty string
                  unit: String(ing.unit || ""), // Default to empty string
                })) : [{ id: uuidv4(), fieldId: uuidv4(), name: "", quantity: "", unit: "" }],
              }))
            : [defaultIngredientGroup(t)],
          instructions: typeof initialData.instructions === 'string'
            ? (initialData.instructions as unknown as string).split('\n').filter(line => line.trim() !== '').map(line => ({ ...defaultInstructionStep(), text: line }))
            : (Array.isArray(initialData.instructions) && initialData.instructions.length > 0 ? initialData.instructions.map(step => ({
                ...step,
                id: step.id || uuidv4(),
                fieldId: step.fieldId || uuidv4(),
                isChecked: step.isChecked || false,
              })) : [defaultInstructionStep()]),
          tips: typeof initialData.tips === 'string'
            ? (initialData.tips as unknown as string).split('\n').filter(line => line.trim() !== '').map(line => ({ ...defaultTipStep(), text: line }))
            : (Array.isArray(initialData.tips) && initialData.tips.length > 0 ? initialData.tips.map(step => ({
                ...step,
                id: step.id || uuidv4(),
                fieldId: step.fieldId || uuidv4(),
                isChecked: step.isChecked || false,
              })) : []),
          imageUrl: initialData.imageUrl || "",
          isPublic: initialData.isPublic || false,
        }
      : {
          title: "",
          description: "",
          ingredientGroups: [defaultIngredientGroup(t)],
          instructions: [defaultInstructionStep()],
          tips: [], 
          tags: "",
          categories: "",
          servingsValue: 4,
          servingsUnit: 'servings',
          prepTime: "",
          cookTime: "",
          imageUrl: "",
          isPublic: false,
        },
  });
  
  const { fields: groupFields, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: "ingredientGroups",
    keyName: "fieldId",
  });

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction, move: moveInstruction } = useFieldArray({
    control: form.control,
    name: "instructions",
    keyName: "fieldId",
  });
  
  const { fields: tipFields, append: appendTip, remove: removeTip, move: moveTip } = useFieldArray({
    control: form.control,
    name: "tips",
    keyName: "fieldId",
  });


  useEffect(() => {
    if (initialData?.imageUrl) setCurrentImageUrlPreview(initialData.imageUrl);
    if (initialData) {
      form.setValue('isPublic', initialData.isPublic || false);

      const currentInstructions = form.getValues('instructions');
      if (!Array.isArray(currentInstructions) || currentInstructions.length === 0) {
        form.setValue('instructions', [defaultInstructionStep()]);
      }
      const currentTips = form.getValues('tips');
       if (!Array.isArray(currentTips)) { 
        form.setValue('tips', []); 
      }
    } else {
        form.setValue('tips', []); 
    }
  }, [initialData, form]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === "INGREDIENT") {
      const sourceDroppableIdParts = source.droppableId.split('-'); 
      const destDroppableIdParts = destination.droppableId.split('-');
      
      const sourceGroupIndex = parseInt(sourceDroppableIdParts[1], 10);
      const destGroupIndex = parseInt(destDroppableIdParts[1], 10);

      const sourceIngredients = [...form.getValues(`ingredientGroups.${sourceGroupIndex}.ingredients`)];
      const [movedItem] = sourceIngredients.splice(source.index, 1);

      if (sourceGroupIndex === destGroupIndex) {
        sourceIngredients.splice(destination.index, 0, movedItem);
        form.setValue(`ingredientGroups.${sourceGroupIndex}.ingredients`, sourceIngredients, { shouldValidate: true, shouldDirty: true });
      } else {
        form.setValue(`ingredientGroups.${sourceGroupIndex}.ingredients`, sourceIngredients, { shouldValidate: true, shouldDirty: true });
        const destIngredients = [...form.getValues(`ingredientGroups.${destGroupIndex}.ingredients`)];
        destIngredients.splice(destination.index, 0, movedItem);
        form.setValue(`ingredientGroups.${destGroupIndex}.ingredients`, destIngredients, { shouldValidate: true, shouldDirty: true });
      }
      toast({ title: t('ingredients_reordered') });

    } else if (type === "INSTRUCTION_STEP") {
      moveInstruction(source.index, destination.index);
      toast({ title: t('instruction_steps_reordered') });
    } else if (type === "TIP_STEP") {
      moveTip(source.index, destination.index);
      toast({ title: t('tip_steps_reordered') });
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
        toast({ title: t("image_processing_toast_title"), description: t("image_processing_toast_desc") });
        const resizedImageUri = await resizeDataUri(result.imageUri, MAX_IMAGE_WIDTH, IMAGE_QUALITY);
        if (resizedImageUri.length > 1048487 * 0.9) {
          toast({ title: t("image_suggestion_error"), description: t("image_still_too_large_error"), variant: "destructive" });
        } else {
          setCurrentImageUrlPreview(resizedImageUri);
          form.setValue("imageUrl", resizedImageUri, { shouldValidate: true, shouldDirty: true });
          toast({ title: t("image_suggestion_success") });
        }
      } else {
        toast({ title: t("image_suggestion_no_result"), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: t("image_suggestion_error"), description: error.message || t("error_generic_title"), variant: "destructive" });
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

    const payloadIngredientGroups = data.ingredientGroups.map(group => ({
      ...group,
      id: group.id || uuidv4(),
      name: group.name || "", // Ensure name is at least an empty string
      ingredients: group.ingredients.map(ing => ({
        ...ing,
        id: ing.id || uuidv4(),
        quantity: ing.quantity || "", // Ensure quantity is at least an empty string
        unit: ing.unit || "", // Ensure unit is at least an empty string
      })),
    }));
    
    const payloadInstructionSteps = data.instructions.map(step => ({
      ...step,
      id: step.id || uuidv4(),
      isChecked: false, 
    }));

    const validTips = (data.tips || []).filter(tip => tip.text && tip.text.trim() !== '');
    const payloadTipSteps = validTips.map(step => ({
      ...step,
      id: step.id || uuidv4(),
      isChecked: false,
    }));


    const recipePayloadBase = {
      ...data,
      servingsValue: Number(data.servingsValue),
      servingsUnit: data.servingsUnit,
      ingredientGroups: payloadIngredientGroups,
      instructions: payloadInstructionSteps,
      tips: payloadTipSteps,
      isPublic: data.isPublic || false,
      tags: Array.isArray(data.tags) ? data.tags : (data.tags?.split(',').map(tag => tag.trim()).filter(tag => tag) || []),
      categories: Array.isArray(data.categories) ? data.categories : (data.categories?.split(',').map(cat => cat.trim()).filter(cat => cat) || []),
      createdBy: initialData?.createdBy || user.uid,
    };

    delete (recipePayloadBase as any).servings;


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
        const newRecipeDataForAdd = { ...recipePayloadBase } as Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;
        const newRecipe = await addRecipe(newRecipeDataForAdd);
        toast({ title: t('recipe_added_successfully') });
        router.push(`/recipes/${newRecipe.id}`);
      }
    } catch (error) {
      const errorMessage = (error as Error).message || t('error_generic_title');
      toast({ title: t('error_saving_recipe'), description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const translateError = (messageKey?: string) => {
    if (!messageKey) return undefined;
    return (messageKey && !messageKey.includes(" ") && !messageKey.includes(".")) ? t(messageKey) : messageKey;
  }

  const watchedImageUrl = form.watch("imageUrl");
  const displayImageUrl = currentImageUrlPreview || watchedImageUrl;

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{isEditMode ? t('edit_recipe') : t('add_recipe')}</CardTitle>
        <ShadcnCardDescription>{t('fill_recipe_details')}</ShadcnCardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <DragDropContext onDragEnd={onDragEnd}>
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('recipe_title')}</FormLabel>
                  <FormControl><Input placeholder={t('recipe_title_placeholder')} {...field} /></FormControl>
                  <FormMessage>{translateError(form.formState.errors.title?.message)}</FormMessage>
                </FormItem>
              )} />

              {(displayImageUrl || imageSuggestionLoading) && (
                <div className="space-y-2">
                  <FormLabel>{t('current_image_label')}</FormLabel>
                  {imageSuggestionLoading ? (
                    <div className="flex items-center justify-center h-48 w-full rounded-md border border-dashed bg-muted/50">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (displayImageUrl?.startsWith('data:image') || displayImageUrl?.startsWith('http')) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayImageUrl} alt={form.getValues("title") || t('suggested_image')} className="rounded-md object-cover border w-full aspect-[16/9]" data-ai-hint="food cooking recipe"/>
                  ) : null}
                </div>
              )}
              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('image_url_optional')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('image_url_placeholder')} {...field} value={field.value || ""} onChange={(e) => { field.onChange(e.target.value); setCurrentImageUrlPreview(undefined); }} />
                  </FormControl>
                  <FormDescription>{t('manual_image_url_desc')}</FormDescription>
                  <FormMessage>{translateError(form.formState.errors.imageUrl?.message)}</FormMessage>
                </FormItem>
              )} />
              <Button type="button" onClick={handleSuggestImage} disabled={imageSuggestionLoading || isSubmitting || !form.watch('title')} variant="outline">
                {imageSuggestionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {t('suggest_image')}
              </Button>

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl><Textarea placeholder={t('description_placeholder')} {...field} value={field.value || ''} /></FormControl>
                  <FormMessage>{translateError(form.formState.errors.description?.message)}</FormMessage>
                </FormItem>
              )} />

              <div className="space-y-4">
                <FormLabel className="text-lg font-semibold">{t('ingredient_groups_label')}</FormLabel>
                  {groupFields.map((groupItem, groupIndex) => (
                    <Card key={groupItem.fieldId} className="p-4 space-y-3 bg-muted/30">
                      <FormField control={form.control} name={`ingredientGroups.${groupIndex}.name`} render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center">
                            <FormLabel>{t('ingredient_group_name_label')} {groupIndex + 1}</FormLabel>
                            {groupFields.length > 1 && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(groupIndex)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive">
                                <Trash2 className="mr-1 h-4 w-4" /> {t('remove_ingredient_group')}
                              </Button>
                            )}
                          </div>
                          <FormControl><Input placeholder={t('ingredient_group_name_placeholder')} {...field} value={field.value || ""} /></FormControl>
                          <FormMessage>{translateError(form.formState.errors.ingredientGroups?.[groupIndex]?.name?.message)}</FormMessage>
                        </FormItem>
                      )} />
                      
                      <NestedIngredientArray groupIndex={groupIndex} control={form.control} />
                      {form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.message && (
                          <p className="text-sm font-medium text-destructive mt-1">
                              {translateError(form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.message)}
                          </p>
                      )}
                      {form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.root?.message && (
                          <p className="text-sm font-medium text-destructive mt-1">
                              {translateError(form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.root?.message)}
                          </p>
                      )}
                    </Card>
                  ))}
                <Button type="button" variant="outline" onClick={() => appendGroup(defaultIngredientGroup(t))}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {t('add_ingredient_group')}
                </Button>
                {(form.formState.errors.ingredientGroups && (form.formState.errors.ingredientGroups.message || (form.formState.errors.ingredientGroups.root && form.formState.errors.ingredientGroups.root.message))) && (
                    <p className="text-sm font-medium text-destructive mt-1">
                        {translateError(form.formState.errors.ingredientGroups.message || (form.formState.errors.ingredientGroups.root && form.formState.errors.ingredientGroups.root.message))}
                    </p>
                  )}
              </div>

              <div className="space-y-4">
                <FormLabel className="text-lg font-semibold">{t('instruction_steps_label')}</FormLabel>
                <Droppable droppableId="instructionStepsDroppable" type="INSTRUCTION_STEP">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                      {instructionFields.map((item, index) => (
                        <Draggable key={item.fieldId} draggableId={item.fieldId!} index={index}>
                          {(providedDraggable, snapshot) => (
                            <InstructionStepField
                              ref={providedDraggable.innerRef}
                              control={form.control}
                              index={index}
                              remove={() => removeInstruction(index)}
                              isDragging={snapshot.isDragging}
                              draggableProps={providedDraggable.draggableProps}
                              dragHandleProps={providedDraggable.dragHandleProps}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <Button type="button" variant="outline" onClick={() => appendInstruction(defaultInstructionStep())}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {t('add_instruction_step')}
                </Button>
                {form.formState.errors.instructions && (form.formState.errors.instructions.message || (form.formState.errors.instructions.root && form.formState.errors.instructions.root.message)) && (
                    <p className="text-sm font-medium text-destructive mt-1">
                        {translateError(form.formState.errors.instructions.message || (form.formState.errors.instructions.root && form.formState.errors.instructions.root.message))}
                    </p>
                )}
              </div>
              
              <div className="space-y-4">
                <FormLabel className="text-lg font-semibold">{t('tip_steps_label')}</FormLabel>
                <FormDescription>{t('tips_description')}</FormDescription>
                 <Droppable droppableId="tipStepsDroppable" type="TIP_STEP">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                      {tipFields.map((item, index) => (
                        <Draggable key={item.fieldId} draggableId={item.fieldId!} index={index}>
                          {(providedDraggable, snapshot) => (
                            <TipStepField
                              ref={providedDraggable.innerRef}
                              control={form.control}
                              index={index}
                              remove={() => removeTip(index)}
                              isDragging={snapshot.isDragging}
                              draggableProps={providedDraggable.draggableProps}
                              dragHandleProps={providedDraggable.dragHandleProps}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <Button type="button" variant="outline" onClick={() => appendTip(defaultTipStep())}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {t('add_tip_step')}
                </Button>
                {form.formState.errors.tips && (form.formState.errors.tips.message || (form.formState.errors.tips.root && form.formState.errors.tips.root.message)) && (
                    <p className="text-sm font-medium text-destructive mt-1">
                        {translateError(form.formState.errors.tips.message || (form.formState.errors.tips.root && form.formState.errors.tips.root.message))}
                    </p>
                )}
              </div>

            </DragDropContext>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="servingsValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('servings_value_label')}</FormLabel>
                    <FormControl><Input type="number" placeholder={t('servings_placeholder_value')} {...field} /></FormControl>
                    <FormMessage>{translateError(form.formState.errors.servingsValue?.message)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="servingsUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('servings_unit_label')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('servings_unit_placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="servings">{t('servings_unit_servings')}</SelectItem>
                        <SelectItem value="pieces">{t('servings_unit_pieces')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage>{translateError(form.formState.errors.servingsUnit?.message)}</FormMessage>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="categories" render={({ field }) => (
                <FormItem><FormLabel>{t('categories')} ({t('comma_separated')})</FormLabel><FormControl><Input placeholder={t('categories_placeholder')} {...field} value={field.value || ''} /></FormControl><FormMessage>{translateError(form.formState.errors.categories?.message)}</FormMessage></FormItem>
              )} />
              <FormField control={form.control} name="tags" render={({ field }) => (
                <FormItem><FormLabel>{t('tags')} ({t('comma_separated')})</FormLabel><FormControl><Input placeholder={t('tags_placeholder')} {...field} value={field.value || ''} /></FormControl><FormMessage>{translateError(form.formState.errors.tags?.message)}</FormMessage></FormItem>
              )} />
            </div>
            
            <FormField control={form.control} name="isPublic" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>{t('make_recipe_public')}</FormLabel><FormDescription>{field.value ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}{t('recipe_public_description')}</FormDescription></div><FormControl><Switch checked={field.value || false} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="prepTime" render={({ field }) => (
                <FormItem><FormLabel>{t('prep_time')}</FormLabel><FormControl><Input placeholder="e.g., 30 mins" {...field} value={field.value || ''} /></FormControl><FormMessage>{translateError(form.formState.errors.prepTime?.message)}</FormMessage></FormItem>
              )} />
              <FormField control={form.control} name="cookTime" render={({ field }) => (
                <FormItem><FormLabel>{t('cook_time')}</FormLabel><FormControl><Input placeholder="e.g., 1 hour" {...field} value={field.value || ''} /></FormControl><FormMessage>{translateError(form.formState.errors.cookTime?.message)}</FormMessage></FormItem>
              )} />
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

interface NestedIngredientArrayProps {
  groupIndex: number;
  control: Control<RecipeFormValues>;
}

function NestedIngredientArray({ groupIndex, control }: NestedIngredientArrayProps) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `ingredientGroups.${groupIndex}.ingredients`,
    keyName: "fieldId",
  });

  return (
    <div className="space-y-2 pl-4 border-l-2 border-primary/30">
       {fields.length > 0 && (
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 gap-y-1 items-end mb-1">
            <div /> 
            <p className="text-xs text-muted-foreground font-medium">{t('ingredient_name')}</p>
            <p className="text-xs text-muted-foreground font-medium">{t('quantity')}</p>
            <p className="text-xs text-muted-foreground font-medium">{t('unit')}</p>
            <div /> 
        </div>
      )}
      <Droppable droppableId={`groupIngredients-${groupIndex}`} type="INGREDIENT">
        {(providedDroppable) => (
          <div
            ref={providedDroppable.innerRef}
            {...providedDroppable.droppableProps}
            className="space-y-2"
          >
            {fields.map((item, ingredientIndex) => (
              <Draggable key={item.fieldId} draggableId={item.fieldId!} index={ingredientIndex}>
                {(providedDraggable, snapshotDraggable) => (
                  <IngredientField
                    ref={providedDraggable.innerRef}
                    control={control}
                    baseName={`ingredientGroups.${groupIndex}.ingredients.${ingredientIndex}`}
                    remove={() => remove(ingredientIndex)}
                    isDragging={snapshotDraggable.isDragging}
                    draggableProps={providedDraggable.draggableProps}
                    dragHandleProps={providedDraggable.dragHandleProps}
                  />
                )}
              </Draggable>
            ))}
            {providedDroppable.placeholder}
          </div>
        )}
      </Droppable>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => append({ id: uuidv4(), fieldId: uuidv4(), name: "", quantity: "", unit: "" })}
        className="mt-2 text-primary hover:text-primary/80"
      >
        <PlusCircle className="mr-2 h-3 w-3" /> {t('add_ingredient')}
      </Button>
    </div>
  );
}

    

    