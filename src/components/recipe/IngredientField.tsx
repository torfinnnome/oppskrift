
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
import type { RecipeFormValues } from "./RecipeForm"; // Assuming RecipeFormValues is exported or defined appropriately

interface IngredientFieldProps {
  control: Control<RecipeFormValues>;
  baseName: `ingredientGroups.${number}.ingredients.${number}`; // More specific baseName
  remove: () => void; // Simplified remove, index is managed by parent
  isDragging?: boolean;
  draggableProps?: DraggableProvidedDraggableProps;
  dragHandleProps?: DraggableProvidedDragHandleProps | null | undefined;
  className?: string;
}

export const IngredientField = React.forwardRef<HTMLDivElement, IngredientFieldProps>(
  ({ control, baseName, remove, isDragging, draggableProps, dragHandleProps, className }, ref) => {
    const { t } = useTranslation();

    return (
      <div
        ref={ref}
        {...draggableProps}
        className={cn(
          "grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-x-2 gap-y-1 items-center p-2 border rounded-md transition-colors",
          isDragging ? "shadow-xl bg-muted opacity-90" : "bg-card hover:bg-muted/50",
          className
        )}
      >
        <div
          {...dragHandleProps}
          className="cursor-grab text-muted-foreground hover:text-foreground self-center justify-self-center touch-none py-2 px-1"
          aria-label={t('drag_ingredient')}
        >
          <Grab className="h-5 w-5" />
        </div>

        <FormField
          control={control}
          name={`${baseName}.name`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('ingredient_name')} {...field} aria-label={t('ingredient_name')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${baseName}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('quantity')} {...field} aria-label={t('quantity')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${baseName}.unit`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('unit')} {...field} aria-label={t('unit')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={remove}
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
