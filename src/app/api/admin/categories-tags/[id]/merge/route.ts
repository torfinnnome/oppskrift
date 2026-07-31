import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/categories-tags/:id/merge
 * Merges the source (id) into the target (targetId). All recipes on the source
 * get connected to the target, then the source is deleted.
 * Body: { targetId: string }
 * Admin-only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("admin")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { targetId } = body;

  if (!targetId || typeof targetId !== "string") {
    return NextResponse.json(
      { message: "targetId is required." },
      { status: 400 }
    );
  }

  if (id === targetId) {
    return NextResponse.json(
      { message: "Cannot merge an item into itself." },
      { status: 400 }
    );
  }

  try {
    const [sourceCat, sourceTag, targetCat, targetTag] = await Promise.all([
      prisma.category.findUnique({ where: { id } }),
      prisma.tag.findUnique({ where: { id } }),
      prisma.category.findUnique({ where: { id: targetId } }),
      prisma.tag.findUnique({ where: { id: targetId } }),
    ]);

    const source = sourceCat ?? sourceTag ?? null;
    const target = targetCat ?? targetTag ?? null;

    if (!source) {
      return NextResponse.json(
        { message: "Source category/tag not found." },
        { status: 404 }
      );
    }
    if (!target) {
      return NextResponse.json(
        { message: "Target category/tag not found." },
        { status: 404 }
      );
    }

    const sourceType = sourceCat ? "category" : "tag";
    const targetType = targetCat ? "category" : "tag";
    if (sourceType !== targetType) {
      return NextResponse.json(
        { message: "Cannot merge different types (category vs tag)." },
        { status: 400 }
      );
    }

    if (sourceType === "category") {
      // Update join table: replace source id with target id
      await prisma.$executeRaw`
        UPDATE "_RecipeCategories"
        SET "A" = ${targetId}
        WHERE "A" = ${id}
        AND NOT EXISTS (
          SELECT 1 FROM "_RecipeCategories" rc2
          WHERE rc2."A" = ${targetId} AND rc2."B" = "_RecipeCategories"."B"
        )
      `;
      await prisma.category.delete({ where: { id } });
    } else {
      // Update join table: replace source id with target id
      await prisma.$executeRaw`
        UPDATE "_RecipeTags"
        SET "B" = ${targetId}
        WHERE "B" = ${id}
        AND NOT EXISTS (
          SELECT 1 FROM "_RecipeTags" rt2
          WHERE rt2."B" = ${targetId} AND rt2."A" = "_RecipeTags"."A"
        )
      `;
      await prisma.tag.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error merging category/tag:", error);
    return NextResponse.json(
      { message: "Error merging category/tag." },
      { status: 500 }
    );
  }
}
