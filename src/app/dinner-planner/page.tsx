"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import type { Recipe, DayMeal, GeneratePlanResponse } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  RefreshCw,
  Copy,
  Lock,
  Unlock,
  Shuffle,
  UtensilsCrossed,
  GripVertical,
} from "lucide-react";
import Link from "next/link";

const DAY_KEYS = [
  "day_monday",
  "day_tuesday",
  "day_wednesday",
  "day_thursday",
  "day_friday",
  "day_saturday",
  "day_sunday",
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createEmptyPlan(): DayMeal[] {
  return DAY_KEYS.map((_, i) => ({
    dayIndex: i,
    recipe: null,
    locked: false,
  }));
}

export default function DinnerPlannerPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t, currentLanguage } = useTranslation();

  const [meals, setMeals] = useState<DayMeal[]>(createEmptyPlan());
  const [pool, setPool] = useState<Recipe[]>([]);
  const [generating, setGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  // Auto-generate plan on page load
  useEffect(() => {
    if (!authLoading && user && !hasGenerated) {
      generatePlan();
    }
  }, [authLoading, user, hasGenerated]);

  const generatePlan = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/dinner-planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: currentLanguage }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error("API error:", res.status, errorText);
        throw new Error(`HTTP ${res.status}`);
      }

      const data: GeneratePlanResponse = await res.json();

      if (data.pool.length === 0 && data.preAssigned.length === 0) {
        toast({
          title: t("no_middag_recipes"),
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const newMeals = createEmptyPlan();

      for (const { dayIndex, recipe } of data.preAssigned) {
        if (newMeals[dayIndex] && !newMeals[dayIndex].recipe) {
          newMeals[dayIndex] = {
            dayIndex,
            recipe,
            locked: true,
          };
        }
      }

      const usedByPreAssigned = new Set(
        newMeals.map((m) => m.recipe?.id).filter(Boolean)
      );

      const availablePool = data.pool.filter((r) => !usedByPreAssigned.has(r.id));
      const shuffledPool = shuffleArray(availablePool);

      for (let i = 0; i < newMeals.length; i++) {
        if (!newMeals[i].recipe && shuffledPool.length > 0) {
          newMeals[i] = {
            dayIndex: i,
            recipe: shuffledPool.shift()!,
            locked: false,
          };
        }
      }

      const allUsedIds = new Set(
        newMeals.map((m) => m.recipe?.id).filter(Boolean)
      );
      const remainingPool = data.pool.filter((r) => !allUsedIds.has(r.id));

      setMeals(newMeals);
      setPool(remainingPool);
      setHasGenerated(true);
    } catch (err) {
      console.error(err);
      toast({
        title: t("error_generic_title"),
        description: t("error_generic_desc"),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [currentLanguage, t]);

  const regenerateUnlocked = useCallback(() => {
    setMeals((prev) => {
      const unlockedIndices = prev
        .map((m, i) => (m.locked ? -1 : i))
        .filter((i) => i >= 0);

      if (unlockedIndices.length === 0) {
        toast({ title: t("lock_day") });
        return prev;
      }

      const lockedRecipeIds = new Set(
        prev.filter((m) => m.locked).map((m) => m.recipe?.id).filter(Boolean)
      );

      const returnedFromUnlocked = prev
        .filter((_, i) => unlockedIndices.includes(i))
        .map((m) => m.recipe)
        .filter((r): r is Recipe => r !== null);

      setPool((currentPool) => {
        const newPool = shuffleArray([...currentPool, ...returnedFromUnlocked]);
        const available = newPool.filter((r) => !lockedRecipeIds.has(r.id));

        const newMeals = [...prev];
        for (let i = 0; i < unlockedIndices.length; i++) {
          const idx = unlockedIndices[i];
          newMeals[idx] = {
            ...newMeals[idx],
            recipe: available[i] || null,
            locked: false,
          };
        }

        const newlyUsed = new Set(
          newMeals.map((m) => m.recipe?.id).filter(Boolean)
        );
        const remaining = newPool.filter((r) => !newlyUsed.has(r.id));
        setMeals(newMeals);
        return remaining;
      });

      return prev;
    });
  }, [t]);

  const toggleLock = useCallback((dayIndex: number) => {
    setMeals((prev) =>
      prev.map((m) =>
        m.dayIndex === dayIndex ? { ...m, locked: !m.locked } : m
      )
    );
  }, []);

  const swapRecipe = useCallback(
    (dayIndex: number) => {
      setMeals((prev) => {
        const current = prev[dayIndex];
        const currentRecipe = current.recipe;
        if (!currentRecipe) return prev;

        const allUsedIds = new Set(
          prev.map((m) => m.recipe?.id).filter(Boolean)
        );

        setPool((currentPool) => {
          const newPool = [...currentPool, currentRecipe];
          const available = newPool.filter((r) => !allUsedIds.has(r.id));

          if (available.length === 0) {
            toast({ title: t("not_enough_recipes") });
            return currentPool;
          }

          const replacement =
            available[Math.floor(Math.random() * available.length)];

          const newMeals = [...prev];
          newMeals[dayIndex] = { ...current, recipe: replacement };

          const newlyUsed = new Set(
            newMeals.map((m) => m.recipe?.id).filter(Boolean)
          );
          const remaining = newPool.filter((r) => !newlyUsed.has(r.id));

          setMeals(newMeals);
          return remaining;
        });

        return prev;
      });
    },
    [t]
  );

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    if (source.index === destination.index) return;

    setMeals((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(source.index, 1);
      updated.splice(destination.index, 0, moved);
      return updated.map((m, i) => ({ ...m, dayIndex: i }));
    });
  }, []);

  const copyPlan = useCallback(async () => {
    const lines = meals.map((m, i) => {
      const dayName = t(DAY_KEYS[i]);
      const recipeName = m.recipe?.title || t("no_recipe");
      return `- ${dayName}: ${recipeName}`;
    });

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("plan_copied") });
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
      toast({ title: t("plan_copied") });
    }
  }, [meals, t]);

  if (authLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t("dinner_planner")}</h1>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t("dinner_planner_title")}</CardTitle>
          <CardDescription>{t("dinner_planner_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {!hasGenerated ? (
              <Button onClick={generatePlan} disabled={generating}>
                <UtensilsCrossed className="mr-2 h-4 w-4" />
                {t("generate_plan")}
              </Button>
            ) : (
              <>
                <Button onClick={regenerateUnlocked} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("regenerate_unlocked")}
                </Button>
                <Button onClick={copyPlan} variant="outline">
                  <Copy className="mr-2 h-4 w-4" />
                  {t("copy_plan")}
                </Button>
              </>
            )}
          </div>

          {hasGenerated && meals.some((m) => !m.recipe) && (
            <p className="text-sm text-muted-foreground">
              {t("not_enough_recipes")}
            </p>
          )}

          {hasGenerated && (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="weekPlan">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {meals.map((meal, index) => (
                      <Draggable
                        key={`${index}-${meal.recipe?.id || "empty"}`}
                        draggableId={`day-${index}`}
                        index={index}
                      >
                        {(providedDraggable, snapshot) => (
                          <div
                            ref={providedDraggable.innerRef}
                            {...providedDraggable.draggableProps}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              snapshot.isDragging
                                ? "shadow-lg bg-muted/50"
                                : "hover:bg-muted/30"
                            }`}
                            onDoubleClick={() => swapRecipe(meal.dayIndex)}
                          >
                            <div
                              {...providedDraggable.dragHandleProps}
                              className="cursor-grab text-muted-foreground hover:text-foreground"
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>

                            <span className="w-24 font-medium shrink-0">
                              {t(DAY_KEYS[index])}
                            </span>

                            <div className="flex-1 min-w-0">
                              {meal.recipe ? (
                                <Link
                                  href={`/recipes/${meal.recipe.id}`}
                                  className="font-medium hover:underline truncate block"
                                >
                                  {meal.recipe.title}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  {t("no_recipe")}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => swapRecipe(meal.dayIndex)}
                                title={t("swap_recipe")}
                                disabled={!meal.recipe && pool.length === 0}
                              >
                                <Shuffle className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleLock(meal.dayIndex)}
                                title={
                                  meal.locked
                                    ? t("unlock_day")
                                    : t("lock_day")
                                }
                              >
                                {meal.locked ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <Unlock className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {!hasGenerated && !generating && (
            <p className="text-muted-foreground text-center py-6">
              {t("generate_plan").toLowerCase() + "..."}
            </p>
          )}

          {generating && (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
