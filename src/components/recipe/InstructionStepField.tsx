
"use client";

import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Grab, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Control } from 'react-hook-form';
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { DraggableProvidedDraggableProps, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import type { RecipeFormValues } from "./RecipeForm";

interface InstructionStepFieldProps {
  control: Control<RecipeFormValues>;
  index: number; // Index of this step in the instructions array
  remove: () => void;
  isDragging?: boolean;
  draggableProps?: DraggableProvidedDraggableProps;
  dragHandleProps?: DraggableProvidedDragHandleProps | null | undefined;
  className?: string;
}

export const InstructionStepField = React.forwardRef<HTMLDivElement, InstructionStepFieldProps>(
  ({ control, index, remove, isDragging, draggableProps, dragHandleProps, className }, ref) => {
    const { t } = useTranslation();

    return (
      <div
        ref={ref}
        {...draggableProps}
        className={cn(
          "flex items-start gap-x-2 p-3 border rounded-md transition-colors",
          isDragging ? "shadow-xl bg-muted opacity-90" : "bg-card hover:bg-muted/50",
          className
        )}
      >
        <div
          {...dragHandleProps}
          className="cursor-grab text-muted-foreground hover:text-foreground self-center pt-2.5 touch-none px-1"
          aria-label={t('drag_instruction_step')}
        >
          <Grab className="h-5 w-5" />
        </div>

        <FormField
          control={control}
          name={`instructions.${index}.text`}
          render={({ field }) => (
            <FormItem className="flex-grow">
              <FormLabel className="sr-only">{t('instruction_step_label', { stepNumber: index + 1 })}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('instruction_step_placeholder', { stepNumber: index + 1 })}
                  {...field}
                  aria-label={t('instruction_step_text_aria', { stepNumber: index + 1 })}
                  rows={2}
                />
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
          aria-label={t('remove_instruction_step')}
          className="shrink-0 text-muted-foreground hover:text-destructive self-center"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);

InstructionStepField.displayName = "InstructionStepField";
