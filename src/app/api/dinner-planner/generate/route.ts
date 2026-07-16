import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MIDDAG_CATEGORY = "middag";

const DAY_TAGS: Record<string, Record<string, number>> = {
  no: {
    mandag: 0,
    tirsdag: 1,
    onsdag: 2,
    torsdag: 3,
    fredag: 4,
    lørdag: 5,
    søndag: 6,
  },
  en: {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  },
  es: {
    lunes: 0,
    martes: 1,
    miercoles: 2,
    miércoles: 2,
    jueves: 3,
    viernes: 4,
    sabado: 5,
    sábado: 5,
    domingo: 6,
  },
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locale = "no" } = await req.json();

  const dayTagMap = DAY_TAGS[locale] || DAY_TAGS.no;

  // Fetch all visible recipes with tags, then filter in app code
  // (SQLite doesn't support case-insensitive mode)
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

  console.log("[dinner-planner] total recipes fetched:", allRecipes.length, "userId:", session.user.id);

  const recipes = allRecipes.filter((recipe) =>
    recipe.categories.some((cat) => cat.name.toLowerCase() === MIDDAG_CATEGORY)
  );

  const preAssigned: { dayIndex: number; recipe: typeof recipes[number] }[] = [];
  const pool: typeof recipes = [];

  for (const recipe of recipes) {
    const categoryNames = recipe.categories.map((c) => c.name.toLowerCase());
    const dayCatEntry = Object.entries(dayTagMap).find(([cat]) => categoryNames.includes(cat));

    if (dayCatEntry) {
      preAssigned.push({
        dayIndex: dayCatEntry[1],
        recipe,
      });
    } else {
      pool.push(recipe);
    }
  }

  return NextResponse.json({ preAssigned, pool });
}
