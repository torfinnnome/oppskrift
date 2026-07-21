import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { PlannerOptions } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all accessible recipes with categories and tags
  const allRecipes = await prisma.recipe.findMany({
    where: {
      OR: [
        { isPublic: true },
        { createdBy: session.user.id },
      ],
    },
    include: {
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
    },
  });

  // Deduplicate by lowercased name, keeping the most common original casing
  const deduplicate = (names: string[]): string[] => {
    const map = new Map<string, { original: string; count: number }>();
    for (const name of names) {
      const key = name.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        // Keep the casing that appears most often; tie-break by keeping first seen
      } else {
        map.set(key, { original: name, count: 1 });
      }
    }
    return Array.from(map.values())
      .map((v) => v.original)
      .sort((a, b) => a.localeCompare(b));
  };

  const allCategoryNames = allRecipes.flatMap((r) =>
    r.categories.map((c) => c.name)
  );
  const allTagNames = allRecipes.flatMap((r) => r.tags.map((t) => t.name));

  const options: PlannerOptions = {
    categories: deduplicate(allCategoryNames),
    tags: deduplicate(allTagNames),
  };

  return NextResponse.json(options);
}
