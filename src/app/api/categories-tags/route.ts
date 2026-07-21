import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/categories-tags
 * Returns all categories and tags with their recipe counts for autocomplete.
 */
export async function GET() {
  try {
    const [categories, tags] = await Promise.all([
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              recipes: true,
            },
          },
        },
        orderBy: {
          recipes: { _count: "desc" },
        },
      }),
      prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              recipes: true,
            },
          },
        },
        orderBy: {
          recipes: { _count: "desc" },
        },
      }),
    ]);

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        count: c._count.recipes,
      })),
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        count: t._count.recipes,
      })),
    });
  } catch (error) {
    console.error("Error fetching categories/tags:", error);
    return NextResponse.json(
      { message: "Error fetching categories/tags." },
      { status: 500 }
    );
  }
}
