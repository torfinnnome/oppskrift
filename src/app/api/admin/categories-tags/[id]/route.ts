import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/categories-tags/:id
 * Fetches a single category or tag by ID.
 * Admin-only.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("admin")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [category, tag] = await Promise.all([
      prisma.category.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { recipes: true } },
        },
      }),
      prisma.tag.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { recipes: true } },
        },
      }),
    ]);

    const item = category
      ? { ...category, type: "category" as const, count: category._count.recipes }
      : tag
        ? { ...tag, type: "tag" as const, count: tag._count.recipes }
        : null;

    if (!item) {
      return NextResponse.json(
        { message: "Category/Tag not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching category/tag:", error);
    return NextResponse.json(
      { message: "Error fetching category/tag." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/categories-tags/:id
 * Deletes a category or tag. Only allowed if no recipes are attached.
 * Admin-only.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("admin")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const category = await prisma.category.findUnique({
      where: { id },
      select: { _count: { select: { recipes: true } } },
    });
    const tag = await prisma.tag.findUnique({
      where: { id },
      select: { _count: { select: { recipes: true } } },
    });

    if (!category && !tag) {
      return NextResponse.json(
        { message: "Category/Tag not found." },
        { status: 404 }
      );
    }

    const count = category ? category._count.recipes : tag!._count.recipes;
    if (count > 0) {
      return NextResponse.json(
        { message: "Cannot delete: this item is still attached to recipes. Merge it first." },
        { status: 409 }
      );
    }

    if (category) {
      await prisma.category.delete({ where: { id } });
    } else {
      await prisma.tag.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category/tag:", error);
    return NextResponse.json(
      { message: "Error deleting category/tag." },
      { status: 500 }
    );
  }
}
