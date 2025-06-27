import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isApproved) {
    return NextResponse.json([]);
  }

  let whereClause: any = {
    OR: [
      { isPublic: true },
      { createdBy: session.user.id },
    ],
  };

  const recipes = await prisma.recipe.findMany({
    where: whereClause,
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
  return NextResponse.json(recipes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  // Add validation here with Zod

  const recipe = await prisma.recipe.create({
    data: {
      ...body,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(recipe, { status: 201 });
}
