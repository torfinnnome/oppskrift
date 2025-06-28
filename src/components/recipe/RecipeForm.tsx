
"use client";

import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Recipe, IngredientGroup, Ingredient, InstructionStep, TipStep, ServingsUnit } from "@/types";
import { useRecipes } from "@/contexts/RecipeContext";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadcnCardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IngredientField } from "./IngredientField";
import { InstructionStepField } from "./InstructionStepField";
import { TipStepField } from "./TipStepField";
import { useTranslation } from "@/lib/i18n";
import { parseRecipeFromText, type ParseRecipeOutput } from "@/ai/flows/parse-recipe-from-text-flow";
import { ocrAndParseRecipeFromImage } from "@/ai/flows/ocr-and-parse-recipe-flow";
import { toast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, PlusCircle, Trash2, Wand2, FileImage, UploadCloud, XCircle, ImageUp, Sparkles, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { v4 as uuidv4 } from "uuid";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
  name: z.string().optional(),
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
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  categories: z.union([z.array(z.string()), z.string()]).optional(),
  servingsValue: z.coerce.number().min(1, "servings_min_value"),
  servingsUnit: z.enum(['servings', 'pieces'], { errorMap: () => ({ message: t("servings_unit_required") }) }),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  imageUrl: z.string().optional(), 
  sourceUrl: z.string().url({ message: t("invalid_url_format") }).optional().or(z.literal("")),
  isPublic: z.boolean().default(true).optional(), // Default isPublic to true
});

export type RecipeFormValues = z.infer<ReturnType<typeof recipeFormSchemaFactory>>;

interface RecipeFormProps {
  initialData?: Recipe;
  isEditMode?: boolean;
}

const MAX_IMAGE_WIDTH = 800;
const IMAGE_QUALITY = 0.7;
const MAX_OCR_IMAGE_SIZE_MB = 4;
const MAX_RECIPE_IMAGE_SIZE_MB = 5;

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

const defaultIngredient = (): Omit<Ingredient, 'id' | 'fieldId'> => ({ name: "", quantity: "", unit: "" });
const defaultIngredientWithIds = (): Ingredient => ({ ...defaultIngredient(), id: uuidv4(), fieldId: uuidv4() });

const defaultIngredientGroup = (t: (key: string) => string): IngredientGroup => ({
  id: uuidv4(),
  fieldId: uuidv4(),
  name: "",
  ingredients: [defaultIngredientWithIds()],
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
  const { data: session } = useSession();
  const { t, currentLanguage } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imageUrl || null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [externalImageUrlInput, setExternalImageUrlInput] = useState(initialData?.imageUrl && initialData.imageUrl.startsWith('http') ? initialData.imageUrl : "");


  const [recipeImportText, setRecipeImportText] = useState("");
  const [isImportingRecipeText, setIsImportingRecipeText] = useState(false);
  const [importTextError, setImportTextError] = useState<string | null>(null);
  const [importedSourceUrl, setImportedSourceUrl] = useState<string | undefined>(initialData?.sourceUrl);

  const [ocrImageFile, setOcrImageFile] = useState<File | null>(null);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [isImportingOcr, setIsImportingOcr] = useState(false);
  const [ocrImportError, setOcrImportError] = useState<string | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOverOcr, setIsDraggingOverOcr] = useState(false);
  const [isDraggingOverRecipeImage, setIsDraggingOverRecipeImage] = useState(false);

  const currentRecipeFormSchema = recipeFormSchemaFactory(t);

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(currentRecipeFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          servingsValue: initialData.servingsValue || (initialData as any).servings || 1,
          servingsUnit: initialData.servingsUnit || 'servings',
          tags: initialData.tags?.map(tag => typeof tag === 'string' ? tag : tag.name) || [],
          categories: initialData.categories?.map(cat => typeof cat === 'string' ? cat : cat.name) || [],
          ingredientGroups: Array.isArray(initialData.ingredientGroups) && initialData.ingredientGroups.length > 0
            ? initialData.ingredientGroups.map(group => ({
                ...group,
                id: group.id || uuidv4(),
                fieldId: group.fieldId || uuidv4(),
                name: group.name || "",
                ingredients: Array.isArray(group.ingredients) ? group.ingredients.map(ing => ({
                  ...ing,
                  id: ing.id || uuidv4(),
                  fieldId: ing.fieldId || uuidv4(),
                  name: String(ing.name || ""),
                  quantity: String(ing.quantity || ""),
                  unit: String(ing.unit || ""),
                })) : [defaultIngredientWithIds()],
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
          sourceUrl: initialData.sourceUrl || "",
          isPublic: initialData.isPublic === undefined ? true : initialData.isPublic, // Default to true if undefined in edit mode
        }
      : {
          title: "",
          description: "",
          ingredientGroups: [defaultIngredientGroup(t)],
          instructions: [defaultInstructionStep()],
          tips: [],
          tags: [],
          categories: [],
          servingsValue: 4,
          servingsUnit: 'servings',
          prepTime: "",
          cookTime: "",
          imageUrl: "",
          sourceUrl: "",
          isPublic: true, // New recipes default to public
        },
  });

  useEffect(() => {
    if (initialData?.imageUrl) {
      setImagePreview(initialData.imageUrl);
      if (initialData.imageUrl.startsWith('http')) {
        setExternalImageUrlInput(initialData.imageUrl);
      } else {
        setExternalImageUrlInput("");
      }
    }
    if (initialData?.sourceUrl) setImportedSourceUrl(initialData.sourceUrl);
    if (initialData) {
      form.setValue('isPublic', initialData.isPublic === undefined ? true : initialData.isPublic); // Also default to true if undefined
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
        form.setValue('isPublic', true); // Ensure new forms default to public
    }
  }, [initialData, form, t]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'imageUrl' && value.imageUrl !== imagePreview) {
        setImagePreview(value.imageUrl || null);
        if (value.imageUrl && value.imageUrl.startsWith('http')) {
          setExternalImageUrlInput(value.imageUrl);
        } else if (!value.imageUrl) {
          setExternalImageUrlInput("");
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, imagePreview]);

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

  const processAndSetUploadedImage = async (dataUri: string) => {
    setIsProcessingImage(true);
    setImageError(null);
    try {
      toast({ title: t("image_processing_toast_title"), description: t("image_processing_toast_desc") });
      const resizedImageUri = await resizeDataUri(dataUri, MAX_IMAGE_WIDTH, IMAGE_QUALITY);
      if (resizedImageUri.length > 1048487 * 0.95) { // Firestore string field limit is ~1MB. Check if data URI is close.
        setImageError(t("image_still_too_large_error"));
        toast({ title: t("image_upload_error_title"), description: t("image_still_too_large_error"), variant: "destructive" });
        form.setValue("imageUrl", ""); // Clear if too large
        setImagePreview(null);
      } else {
        form.setValue("imageUrl", resizedImageUri, { shouldValidate: true, shouldDirty: true });
        setImagePreview(resizedImageUri);
        setExternalImageUrlInput(""); // Clear external URL if upload is successful
      }
    } catch (error: any) {
      setImageError(t("image_upload_error_generic"));
      toast({ title: t("image_upload_error_title"), description: t("image_upload_error_generic"), variant: "destructive" });
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleImageFileSelected = (file: File | null) => {
    if (!file) return;
    setImageError(null);

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageError(t("image_upload_error_type"));
      toast({ title: t("image_upload_error_title"), description: t("image_upload_error_type"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_RECIPE_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageError(t("image_upload_error_size", {maxSize: MAX_RECIPE_IMAGE_SIZE_MB}));
      toast({ title: t("image_upload_error_title"), description: t("image_upload_error_size", {maxSize: MAX_RECIPE_IMAGE_SIZE_MB}), variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        processAndSetUploadedImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRecipeImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOverRecipeImage(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleImageFileSelected(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  };

  const handleExternalImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExternalImageUrlInput(e.target.value);
  };

  const handleExternalImageUrlBlur = () => {
    const url = externalImageUrlInput.trim();
    if (url) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            new URL(url); // More robust validation
            form.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true });
            setImagePreview(url);
            setImageError(null);
        } catch (_) {
            setImageError(t("invalid_external_image_url"));
            toast({ title: t("image_upload_error_title"), description: t("invalid_external_image_url"), variant: "destructive" });
        }
      } else if (url !== "") { // if not empty and not a valid URL start
        setImageError(t("invalid_external_image_url"));
        toast({ title: t("image_upload_error_title"), description: t("invalid_external_image_url"), variant: "destructive" });
      }
    } else { 
        if (imagePreview && imagePreview.startsWith('http')) { // Only clear if it was an external URL
            form.setValue("imageUrl", "");
            setImagePreview(null);
        }
    }
  };

  const handleClearImage = () => {
    form.setValue("imageUrl", "");
    setImagePreview(null);
    setExternalImageUrlInput("");
    setImageError(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = "";
    }
  };

  const commonResetFormWithParsedData = (parsedData: ParseRecipeOutput) => {
    const formValuesToSet: Partial<RecipeFormValues> = {
      title: parsedData.title,
      description: parsedData.description || "",
      ingredientGroups: (parsedData.ingredientGroups && parsedData.ingredientGroups.length > 0)
        ? parsedData.ingredientGroups.map(g => ({
            id: uuidv4(), fieldId: uuidv4(), name: g.name || "",
            ingredients: g.ingredients.map(i => ({
              id: uuidv4(), fieldId: uuidv4(), name: i.name, quantity: i.quantity || "", unit: i.unit || ""
            }))
          })) : [defaultIngredientGroup(t)],
      instructions: (parsedData.instructions && parsedData.instructions.length > 0)
        ? parsedData.instructions.map(step => ({ id: uuidv4(), fieldId: uuidv4(), text: step.text, isChecked: false }))
        : [defaultInstructionStep()],
      tips: (parsedData.tips && parsedData.tips.length > 0)
        ? parsedData.tips.map(tip => ({ id: uuidv4(), fieldId: uuidv4(), text: tip.text, isChecked: false }))
        : [],
      servingsValue: parsedData.servingsValue || 4,
      servingsUnit: parsedData.servingsUnit || 'servings',
      prepTime: parsedData.prepTime || "",
      cookTime: parsedData.cookTime || "",
      tags: typeof parsedData.tags === 'string' ? parsedData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
      categories: typeof parsedData.categories === 'string' ? parsedData.categories.split(',').map((cat: string) => cat.trim()).filter(Boolean) : [],
      imageUrl: parsedData.extractedImageUrl || "",
      sourceUrl: parsedData.sourceUrl || "",
      isPublic: form.getValues("isPublic") // Keep existing isPublic, or default to true
    };
    form.reset(formValuesToSet);
    setImagePreview(parsedData.extractedImageUrl || null);
    if (parsedData.extractedImageUrl && parsedData.extractedImageUrl.startsWith('http')) {
        setExternalImageUrlInput(parsedData.extractedImageUrl);
    } else {
        setExternalImageUrlInput("");
    }
    if (formValuesToSet.isPublic === undefined) { // Ensure isPublic is set after reset
        form.setValue('isPublic', true);
    }
  };

  const handleImportRecipeText = async () => {
    if (!recipeImportText.trim()) {
      setImportTextError(t("recipe_import_empty_input_error"));
      return;
    }
    setIsImportingRecipeText(true); setImportTextError(null); setImportedSourceUrl(undefined); form.setValue("sourceUrl", "");
    try {
      const parsedData: ParseRecipeOutput = await parseRecipeFromText({ inputText: recipeImportText });
      commonResetFormWithParsedData(parsedData);
      if (parsedData.sourceUrl) setImportedSourceUrl(parsedData.sourceUrl);
      toast({ title: t("recipe_import_success_title") }); setRecipeImportText("");
    } catch (error: any) {
      const errorMessage = error.message || t("recipe_import_error_generic");
      setImportTextError(errorMessage); toast({ title: t("recipe_import_error_title"), description: errorMessage, variant: "destructive" });
    } finally { setIsImportingRecipeText(false); }
  };

  const processOcrImageFile = (file: File | null) => {
    if (!file) { setOcrImageFile(null); setOcrImagePreview(null); setOcrImportError(null); return; }
    if (file.size > MAX_OCR_IMAGE_SIZE_MB * 1024 * 1024) {
      setOcrImportError(t("ocr_image_too_large_error", { maxSize: MAX_OCR_IMAGE_SIZE_MB }));
      setOcrImageFile(null); setOcrImagePreview(null); if (ocrFileInputRef.current) ocrFileInputRef.current.value = ""; return;
    }
    if (!file.type.startsWith('image/')) {
      setOcrImportError(t("ocr_invalid_file_type"));
      setOcrImageFile(null); setOcrImagePreview(null); if (ocrFileInputRef.current) ocrFileInputRef.current.value = ""; return;
    }
    setOcrImageFile(file); setOcrImportError(null); const reader = new FileReader();
    reader.onloadend = () => { setOcrImagePreview(reader.result as string); };
    reader.readAsDataURL(file);
  };
  const handleOcrImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { processOcrImageFile(event.target.files?.[0] || null); };
  const handleOcrDragOver = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); setIsDraggingOverOcr(true); };
  const handleOcrDragLeave = (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); if (event.currentTarget.contains(event.relatedTarget as Node)) return; setIsDraggingOverOcr(false); };
  const handleOcrDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); setIsDraggingOverOcr(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) { processOcrImageFile(event.dataTransfer.files[0]); event.dataTransfer.clearData(); }
  };
  const handleImportFromOcr = async () => {
    if (!ocrImageFile || !ocrImagePreview) { setOcrImportError(t("ocr_no_image_selected_error")); return; }
    setIsImportingOcr(true); setOcrImportError(null); setImportedSourceUrl(undefined); form.setValue("sourceUrl", "");
    try {
      const parsedData: ParseRecipeOutput = await ocrAndParseRecipeFromImage({ imageDataUri: ocrImagePreview, userLanguageCode: currentLanguage });
      commonResetFormWithParsedData(parsedData);
      toast({ title: t("ocr_import_success_title") });
      setOcrImageFile(null); setOcrImagePreview(null); if (ocrFileInputRef.current) ocrFileInputRef.current.value = "";
    } catch (error: any) {
      const errorMessage = error.message || t("ocr_import_error_generic");
      setOcrImportError(errorMessage); toast({ title: t("ocr_import_error_title"), description: errorMessage, variant: "destructive" });
    } finally { setIsImportingOcr(false); }
  };

  const onSubmit = async (data: RecipeFormValues) => {
    if (!session) { toast({ title: t("must_be_logged_in"), variant: "destructive" }); return; }
    setIsSubmitting(true);
    const payloadIngredientGroups = data.ingredientGroups.map(group => ({
      ...group, id: group.id || uuidv4(), name: group.name || "",
      ingredients: group.ingredients.map(ing => ({ ...ing, id: ing.id || uuidv4(), quantity: ing.quantity || "", unit: ing.unit || "" })),
    }));
    const payloadInstructionSteps = data.instructions.map(step => ({ ...step, id: step.id || uuidv4(), isChecked: false }));
    const validTips = (data.tips || []).filter(tip => tip.text && tip.text.trim() !== '');
    const payloadTipSteps = validTips.map(step => ({ ...step, id: step.id || uuidv4(), isChecked: false }));
    const recipePayloadBase = {
      ...data, servingsValue: Number(data.servingsValue), servingsUnit: data.servingsUnit as ServingsUnit,
      ingredientGroups: payloadIngredientGroups, instructions: payloadInstructionSteps, tips: payloadTipSteps,
      sourceUrl: data.sourceUrl || undefined, 
      isPublic: data.isPublic === undefined ? true : data.isPublic, // Ensure isPublic has a value
      tags: Array.isArray(data.tags) ? data.tags : (data.tags?.split(',').map(tag => tag.trim()).filter(tag => tag) || []),
      categories: Array.isArray(data.categories) ? data.categories : (data.categories?.split(',').map(cat => cat.trim()).filter(cat => cat) || []),
      createdBy: initialData?.createdBy || session.user.id,
    };
    delete (recipePayloadBase as any).servings; 
    try {
      if (isEditMode && initialData?.id) {
        const updatedRecipeData: Recipe = {
          ...initialData, ...recipePayloadBase, id: initialData.id,
          updatedAt: new Date().toISOString(), createdAt: initialData.createdAt || new Date().toISOString(),
        };
        await updateRecipe(updatedRecipeData);
        toast({ title: t('recipe_updated_successfully') }); router.push(`/recipes/${initialData.id}`);
      } else {
        const newRecipeDataForAdd = { ...recipePayloadBase } as Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;
        const newRecipe = await addRecipe(newRecipeDataForAdd);
        toast({ title: t('recipe_added_successfully') }); router.push(`/recipes/${newRecipe.id}`);
      }
    } catch (error) {
      const errorMessage = (error as Error).message || t('error_saving_recipe');
      toast({ title: t('error_saving_recipe'), description: errorMessage, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const translateError = (messageKey?: string) => {
    if (!messageKey) return undefined;
    return (messageKey && !messageKey.includes(" ") && !messageKey.includes(".")) ? t(messageKey) : messageKey;
  }

  const anyImportInProgress = isImportingRecipeText || isImportingOcr;

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">{isEditMode ? t('edit_recipe') : t('add_recipe')}</CardTitle>
        <ShadcnCardDescription>{t('fill_recipe_details')}</ShadcnCardDescription>
      </CardHeader>
      <CardContent>
        <Card className="mb-6 bg-muted/20 border-dashed">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />{t('recipe_import_ai_title')}</CardTitle>
            <ShadcnCardDescription>{t('recipe_import_ai_description')}</ShadcnCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea placeholder={t('recipe_import_placeholder')} value={recipeImportText} onChange={(e) => setRecipeImportText(e.target.value)} rows={3} disabled={anyImportInProgress} />
            <Button type="button" onClick={handleImportRecipeText} disabled={anyImportInProgress || !recipeImportText.trim()}>
              {isImportingRecipeText ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} {t('recipe_import_button')}
            </Button>
            {importTextError && <Alert variant="destructive"><AlertTitle>{t('recipe_import_error_title')}</AlertTitle><AlertDescription>{importTextError}</AlertDescription></Alert>}
            {importedSourceUrl && !form.getValues("sourceUrl") && (
              <div className="text-sm text-muted-foreground mt-2">
                <span className="font-medium">{t('imported_from_url')}: </span>
                <Link href={importedSourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{importedSourceUrl}</Link>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="mb-6 bg-muted/20 border-dashed">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><ImageUp className="h-5 w-5 text-primary" />{t('ocr_import_title')}</CardTitle>
                <ShadcnCardDescription>{t('ocr_import_description')}</ShadcnCardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div
                  className={cn( "flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/80 transition-colors",
                    isDraggingOverOcr ? "border-primary bg-primary/10" : "border-muted-foreground/50 bg-muted/20",
                    ocrImagePreview && !isDraggingOverOcr && "border-primary/50"
                  )}
                  onClick={() => ocrFileInputRef.current?.click()}
                  onDragOver={handleOcrDragOver} onDragEnter={handleOcrDragOver} onDragLeave={handleOcrDragLeave} onDrop={handleOcrDrop}
                  role="button" tabIndex={0} aria-label={t('ocr_drop_image_or_select')} >
                  <UploadCloud className={cn("h-8 w-8 mb-2", isDraggingOverOcr ? "text-primary" : "text-muted-foreground")} />
                  <p className="text-xs text-muted-foreground text-center">{isDraggingOverOcr ? t('ocr_drop_image_here') : (ocrImageFile ? ocrImageFile.name : t('ocr_drop_image_or_select'))}</p>
                   {!ocrImageFile && !isDraggingOverOcr && <span className="text-xs text-muted-foreground/70 mt-1">({t('ocr_max_size_info', {maxSize: MAX_OCR_IMAGE_SIZE_MB})})</span>}
                </div>
                <Input id="ocr-image-upload" type="file" accept="image/*" onChange={handleOcrImageFileChange} className="hidden" ref={ocrFileInputRef} disabled={anyImportInProgress}/>
                {ocrImagePreview && ( <div className="my-2"><Label>{t('ocr_image_preview_label')}</Label><img src={ocrImagePreview} alt={t('ocr_image_preview_alt')} className="rounded-md border max-h-40 w-auto object-contain" data-ai-hint="recipe image"/></div> )}
                {ocrImageFile && ( <Button type="button" onClick={handleImportFromOcr} disabled={anyImportInProgress || !ocrImageFile}> {isImportingOcr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} {t('ocr_import_button')} </Button> )}
                {ocrImportError && <Alert variant="destructive"><AlertTitle>{t('ocr_import_error_title')}</AlertTitle><AlertDescription>{ocrImportError}</AlertDescription></Alert>}
            </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DragDropContext onDragEnd={onDragEnd}>
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('recipe_title')}</FormLabel>
                  <FormControl><Input placeholder={t('recipe_title_placeholder')} {...field} /></FormControl>
                  <FormMessage>{translateError(form.formState.errors.title?.message)}</FormMessage>
                </FormItem>
              )} />

              <Card className="bg-card border">
                <CardHeader>
                    <CardTitle className="text-lg">{t('image_section_title')}</CardTitle>
                    <ShadcnCardDescription>{t('image_section_description')}</ShadcnCardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {imagePreview && (
                        <div className="relative group">
                            <img src={DOMPurify.sanitize(imagePreview)} alt={t('image_preview_alt')} className="rounded-md object-cover border w-full aspect-[16/9]" data-ai-hint="food cooking recipe"/>
                            <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleClearImage} aria-label={t('remove_image_button')}>
                                <XCircle className="h-5 w-5"/>
                            </Button>
                        </div>
                    )}
                    {isProcessingImage && <div className="flex items-center justify-center h-32 w-full rounded-md border border-dashed bg-muted/50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                    
                    {!imagePreview && !isProcessingImage && (
                         <div
                            className={cn(
                                "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/80 transition-colors",
                                isDraggingOverRecipeImage ? "border-primary bg-primary/10" : "border-muted-foreground/50 bg-muted/30"
                            )}
                            onClick={() => imageFileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOverRecipeImage(true); }}
                            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOverRecipeImage(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDraggingOverRecipeImage(false);}}
                            onDrop={handleRecipeImageDrop}
                            role="button" tabIndex={0} aria-label={t('drop_image_here_recipe')}
                        >
                            <UploadCloud className={cn("h-10 w-10 mb-2", isDraggingOverRecipeImage ? "text-primary" : "text-muted-foreground")} />
                            <p className="text-sm text-muted-foreground text-center">{t('drop_image_here_recipe')}</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">({t('max_image_size_info', { maxSize: MAX_RECIPE_IMAGE_SIZE_MB })})</p>
                        </div>
                    )}
                    <Input id="image-upload-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => handleImageFileSelected(e.target.files?.[0] || null)} className="hidden" ref={imageFileInputRef} />
                    
                    <div className="space-y-1">
                        <Label htmlFor="external-image-url" className="text-xs text-muted-foreground">{t('or_external_image_url_label')}</Label>
                        <div className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Input 
                                id="external-image-url"
                                type="url" 
                                placeholder={t('external_image_url_placeholder')} 
                                value={externalImageUrlInput}
                                onChange={handleExternalImageUrlChange}
                                onBlur={handleExternalImageUrlBlur}
                                className="h-9 text-sm"
                                disabled={isProcessingImage}
                            />
                        </div>
                    </div>
                    {imageError && <FormMessage>{imageError}</FormMessage>}
                </CardContent>
              </Card>

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl><Textarea placeholder={t('description_placeholder')} {...field} value={field.value || ''} /></FormControl>
                  <FormMessage>{translateError(form.formState.errors.description?.message)}</FormMessage>
                </FormItem>
              )} />
              <FormField control={form.control} name="sourceUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('source_url_optional')}</FormLabel>
                  <FormControl><Input placeholder={t('source_url_placeholder')} {...field} value={field.value || ''} onChange={(e) => { field.onChange(e.target.value); setImportedSourceUrl(undefined); }}/></FormControl>
                  <FormDescription>{t('source_url_description')}</FormDescription>
                  <FormMessage>{translateError(form.formState.errors.sourceUrl?.message)}</FormMessage>
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
                      {form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.message && (<p className="text-sm font-medium text-destructive mt-1">{translateError(form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.message)}</p>)}
                      {form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.root?.message && (<p className="text-sm font-medium text-destructive mt-1">{translateError(form.formState.errors.ingredientGroups?.[groupIndex]?.ingredients?.root?.message)}</p>)}
                    </Card>
                  ))}
                <Button type="button" variant="outline" onClick={() => appendGroup(defaultIngredientGroup(t))}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {t('add_ingredient_group')}
                </Button>
                {(form.formState.errors.ingredientGroups && (form.formState.errors.ingredientGroups.message || (form.formState.errors.ingredientGroups.root && form.formState.errors.ingredientGroups.root.message))) && (
                    <p className="text-sm font-medium text-destructive mt-1">{translateError(form.formState.errors.ingredientGroups.message || (form.formState.errors.ingredientGroups.root && form.formState.errors.ingredientGroups.root.message))}</p>
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
                            <InstructionStepField ref={providedDraggable.innerRef} control={form.control} index={index} remove={() => removeInstruction(index)} isDragging={snapshot.isDragging} draggableProps={providedDraggable.draggableProps} dragHandleProps={providedDraggable.dragHandleProps} />
                          )}
                        </Draggable>
                      ))} {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <Button type="button" variant="outline" onClick={() => appendInstruction(defaultInstructionStep())}><PlusCircle className="mr-2 h-4 w-4" /> {t('add_instruction_step')}</Button>
                {form.formState.errors.instructions && (form.formState.errors.instructions.message || (form.formState.errors.instructions.root && form.formState.errors.instructions.root.message)) && (<p className="text-sm font-medium text-destructive mt-1">{translateError(form.formState.errors.instructions.message || (form.formState.errors.instructions.root && form.formState.errors.instructions.root.message))}</p>)}
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
                            <TipStepField ref={providedDraggable.innerRef} control={form.control} index={index} remove={() => removeTip(index)} isDragging={snapshot.isDragging} draggableProps={providedDraggable.draggableProps} dragHandleProps={providedDraggable.dragHandleProps} />
                          )}
                        </Draggable>
                      ))} {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <Button type="button" variant="outline" onClick={() => appendTip(defaultTipStep())}><PlusCircle className="mr-2 h-4 w-4" /> {t('add_tip_step')}</Button>
                {form.formState.errors.tips && (form.formState.errors.tips.message || (form.formState.errors.tips.root && form.formState.errors.tips.root.message)) && (<p className="text-sm font-medium text-destructive mt-1">{translateError(form.formState.errors.tips.message || (form.formState.errors.tips.root && form.formState.errors.tips.root.message))}</p>)}
              </div>
            </DragDropContext>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="servingsValue" render={({ field }) => (
                  <FormItem><FormLabel>{t('servings_value_label')}</FormLabel><FormControl><Input type="number" placeholder={t('servings_placeholder_value')} {...field} /></FormControl><FormMessage>{translateError(form.formState.errors.servingsValue?.message)}</FormMessage></FormItem>
              )} />
              <FormField control={form.control} name="servingsUnit" render={({ field }) => (
                  <FormItem><FormLabel>{t('servings_unit_label')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('servings_unit_placeholder')} /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="servings">{t('servings_unit_servings')}</SelectItem><SelectItem value="pieces">{t('servings_unit_pieces')}</SelectItem></SelectContent>
                    </Select><FormMessage>{translateError(form.formState.errors.servingsUnit?.message)}</FormMessage>
                  </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="categories" render={({ field }) => (
                <FormItem><FormLabel>{t('categories')} ({t('comma_separated')})</FormLabel><FormControl><Input placeholder={t('categories_placeholder')} {...field} value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage>{translateError(form.formState.errors.categories?.message)}</FormMessage></FormItem>
              )} />
              <FormField control={form.control} name="tags" render={({ field }) => (
                <FormItem><FormLabel>{t('tags')} ({t('comma_separated')})</FormLabel><FormControl><Input placeholder={t('tags_placeholder')} {...field} value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage>{translateError(form.formState.errors.tags?.message)}</FormMessage></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="isPublic" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>{t('make_recipe_public_default_true')}</FormLabel><FormDescription>{field.value ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}{field.value ? t('recipe_public_description_true_default') : t('recipe_private_description_explicit')}</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="prepTime" render={({ field }) => (
                <FormItem><FormLabel>{t('prep_time')}</FormLabel><FormControl><Input placeholder="e.g., 30 mins" {...field} value={field.value || ''} /></FormControl><FormMessage>{translateError(form.formState.errors.prepTime?.message)}</FormMessage></FormItem>
              )} />
              <FormField control={form.control} name="cookTime" render={({ field }) => (
                <FormItem><FormLabel>{t('cook_time')}</FormLabel><FormControl><Input placeholder="e.g., 1 hour" {...field} value={field.value || ''} /></FormControl><FormMessage>{translateError(form.formState.errors.cookTime?.message)}</FormMessage></FormItem>
              )} />
            </div>
            <Button type="submit" disabled={isSubmitting || isProcessingImage || anyImportInProgress} className="w-full sm:w-auto">
              {(isSubmitting || isProcessingImage || anyImportInProgress) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  const { fields, append, remove } = useFieldArray({ control, name: `ingredientGroups.${groupIndex}.ingredients`, keyName: "fieldId" });
  return (
    <div className="space-y-2 pl-4 border-l-2 border-primary/30">
       {fields.length > 0 && (
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 gap-y-1 items-end mb-1">
            <div />
            <p className="text-xs text-muted-foreground font-medium">{t('ingredient_name')}</p>
            <p className="text-xs text-muted-foreground font-medium">{t('quantity')}</p>
            <p className="text-xs text-muted-foreground font-medium">{t('unit')}</p>
            <div />
        </div> )}
      <Droppable droppableId={`groupIngredients-${groupIndex}`} type="INGREDIENT">
        {(providedDroppable) => (
          <div ref={providedDroppable.innerRef} {...providedDroppable.droppableProps} className="space-y-2">
            {fields.map((item, ingredientIndex) => (
              <Draggable key={item.fieldId} draggableId={item.fieldId!} index={ingredientIndex}>
                {(providedDraggable, snapshotDraggable) => ( <IngredientField ref={providedDraggable.innerRef} control={control} baseName={`ingredientGroups.${groupIndex}.ingredients.${ingredientIndex}`} remove={() => remove(ingredientIndex)} isDragging={snapshotDraggable.isDragging} draggableProps={providedDraggable.draggableProps} dragHandleProps={providedDraggable.dragHandleProps} /> )}
              </Draggable>
            ))} {providedDroppable.placeholder}
          </div>
        )}
      </Droppable>
      <Button type="button" variant="ghost" size="sm" onClick={() => append(defaultIngredientWithIds())} className="mt-2 text-primary hover:text-primary/80"><PlusCircle className="mr-2 h-3 w-3" /> {t('add_ingredient')}</Button>
    </div>
  );
}

