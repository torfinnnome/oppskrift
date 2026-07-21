import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { GeneratePlanRequest } from "@/types";

// Merged day-name → index map across all supported languages (case-insensitive keys)
const DAY_TO_INDEX: Record<string, number> = {
  // Norwegian
  mandag: 0,
  tirsdag: 1,
  onsdag: 2,
  torsdag: 3,
  fredag: 4,
  lørdag: 5,
  søndag: 6,
  // English
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
  // Spanish
  lunes: 0,
  martes: 1,
  miercoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5,
  domingo: 6,
  // Accented variants
  miércoles: 2,
  sábado: 5,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GeneratePlanRequest = await req.json();
  const categoryFilters = (body.categoryFilters || [])
    .filter(Boolean)
    .map((c: string) => c.toLowerCase());
  const tagFilters = (body.tagFilters || [])
    .filter(Boolean)
    .map((t: string) => t.toLowerCase());

  // Fetch all visible recipes with tags, categories, etc.
  const allRecipes = await prisma.recipe.findMany({
    where: {
      OR: [
        { isPublic: true },
        { createdBy: session.user.id },
      ],
    },
    include: {
      ingredientGroups: {
        include: {
          ingredients: true,
        },
      },
      instructions: true,
      tips: true,
      tags: {
        select: {
          name: true,
        },
      },
      categories: {
        select: {
          name: true,
        },
      },
      ratings: true,
    },
  });

  console.log(
    "[dinner-planner] total recipes fetched:",
    allRecipes.length,
    "userId:",
    session.user.id,
    "categoryFilters:",
    categoryFilters,
    "tagFilters:",
    tagFilters
  );

  // Filter by user-selected categories and tags (case-insensitive, OR within each group)
  let recipes = allRecipes;

  if (categoryFilters.length > 0) {
    recipes = recipes.filter((recipe) =>
      recipe.categories.some((cat) =>
        categoryFilters.includes(cat.name.toLowerCase())
      )
    );
  }

  if (tagFilters.length > 0) {
    recipes = recipes.filter((recipe) =>
      recipe.tags.some((tag) => tagFilters.includes(tag.name.toLowerCase()))
    );
  }

  const preAssigned: { dayIndex: number; recipe: typeof recipes[number] }[] = [];
  const pool: typeof recipes = [];

  for (const recipe of recipes) {
    const categoryNamesLower = recipe.categories.map((c) => c.name.toLowerCase());
    const dayEntry = Object.entries(DAY_TO_INDEX).find(([dayName]) =>
      categoryNamesLower.includes(dayName)
    );

    if (dayEntry) {
      preAssigned.push({
        dayIndex: dayEntry[1],
        recipe,
      });
    } else {
      pool.push(recipe);
    }
  }

  return NextResponse.json({ preAssigned, pool });
}
