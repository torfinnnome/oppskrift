import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/admin/categories-tags/:id/rename
 * Renames a category or tag. Body: { name: string }
 * Admin-only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("admin")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const newName = typeof body.name === "string" ? body.name.trim() : "";

  if (!newName) {
    return NextResponse.json({ message: "Name is required." }, { status: 400 });
  }

  try {
    const existingCategory = await prisma.category.findUnique({ where: { id } });
    const existingTag = await prisma.tag.findUnique({ where: { id } });

    if (!existingCategory && !existingTag) {
      return NextResponse.json(
        { message: "Category/Tag not found." },
        { status: 404 }
      );
    }

    const collisionCategory = await prisma.category.findFirst({
      where: { name: newName },
    });
    const collisionTag = await prisma.tag.findFirst({
      where: { name: newName },
    });

    if (collisionCategory || collisionTag) {
      return NextResponse.json(
        { message: "A category/tag with this name already exists (case-insensitive)." },
        { status: 409 }
      );
    }

    let result;
    if (existingCategory) {
      result = await prisma.category.update({
        where: { id },
        data: { name: newName },
      });
    } else {
      result = await prisma.tag.update({
        where: { id },
        data: { name: newName },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error renaming category/tag:", error);
    return NextResponse.json(
      { message: "Error renaming category/tag." },
      { status: 500 }
    );
  }
}
