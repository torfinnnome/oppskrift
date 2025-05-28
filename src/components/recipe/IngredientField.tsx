
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Grab, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Control } from 'react-hook-form';
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from 'react-beautiful-dnd';

// Updated to match the structure where RecipeFormValues includes ingredients array
interface RecipeFormValues {
  ingredients: {
    name: string;
    quantity: string;
    unit: string;
    id?: string;
    fieldId?: string; // from useFieldArray
  }[];
  // other fields from RecipeFormValues if needed for context, but control is primary
}

interface IngredientFieldProps {
  control: Control<RecipeFormValues>; // Control object from the main form
  index: number;
  remove: (index: number) => void;
  isDragging?: boolean;
  draggableProps?: DraggableProvidedDraggableProps; // from react-beautiful-dnd
  dragHandleProps?: DraggableProvidedDragHandleProps | null | undefined; // from react-beautiful-dnd
  className?: string;
}

export const IngredientField = React.forwardRef<HTMLDivElement, IngredientFieldProps>(
  ({ control, index, remove, isDragging, draggableProps, dragHandleProps, className }, ref) => {
    const { t } = useTranslation();

    return (
      // Apply `ref` (innerRef) and `draggableProps` to the outermost element
      <div
        ref={ref}
        {...draggableProps}
        className={cn(
          "grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 gap-y-1 items-center p-2 border rounded-md transition-colors",
          isDragging ? "shadow-xl bg-muted opacity-90" : "bg-card hover:bg-muted/50",
          className
        )}
        // react-beautiful-dnd applies its own style, so draggableProps.style might be redundant
        // or could be merged if specific overrides are needed.
      >
        {/* Apply `dragHandleProps` to the element that will serve as the drag handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab text-muted-foreground hover:text-foreground self-center justify-self-center touch-none py-2 px-1"
          aria-label={t('drag_ingredient')} // Add accessibility label
        >
          <Grab className="h-5 w-5" />
        </div>

        {/* Name Input */}
        <FormField
          control={control}
          name={`ingredients.${index}.name`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('ingredient_name')} {...field} aria-label={t('ingredient_name')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Quantity Input */}
        <FormField
          control={control}
          name={`ingredients.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('quantity')} {...field} aria-label={t('quantity')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Unit Input */}
        <FormField
          control={control}
          name={`ingredients.${index}.unit`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('unit')} {...field} aria-label={t('unit')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Remove Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => remove(index)}
          aria-label={t('remove_ingredient')}
          className="shrink-0 text-muted-foreground hover:text-destructive self-center justify-self-center"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);

IngredientField.displayName = "IngredientField";
