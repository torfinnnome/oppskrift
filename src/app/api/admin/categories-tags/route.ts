import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/categories-tags
 * Returns all categories and tags with recipe counts, sorted by count descending.
 * Admin-only.
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("admin")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [categories, tags] = await Promise.all([
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              recipes: true,
            },
          },
        },
        orderBy: { recipes: { _count: "desc" } },
      }),
      prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              recipes: true,
            },
          },
        },
        orderBy: { recipes: { _count: "desc" } },
      }),
    ]);

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
        count: c._count.recipes,
        type: "category" as const,
      })),
      tags: tags.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        count: t._count.recipes,
        type: "tag" as const,
      })),
    });
  } catch (error) {
    console.error("Error fetching categories/tags for admin:", error);
    return NextResponse.json(
      { message: "Error fetching categories/tags." },
      { status: 500 }
    );
  }
}
