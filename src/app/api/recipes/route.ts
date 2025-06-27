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

  const { ingredientGroups, instructions, tips, tags, categories, ...rest } = await req.json();
  // Add validation here with Zod

  const recipe = await prisma.recipe.create({
    data: {
      ...rest,
      createdBy: session.user.id,
      ingredientGroups: {
        create: ingredientGroups.map((group: any) => ({
          name: group.name,
          ingredients: {
            create: group.ingredients.map((ingredient: any) => ({
              name: ingredient.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
            })),
          },
        })),
      },
      instructions: {
        create: instructions.map((instruction: any) => ({
          text: instruction.text,
        })),
      },
      tips: {
        create: tips.map((tip: any) => ({
          text: tip.text,
        })),
      },
      tags: {
        connectOrCreate: tags.map((tag: string) => ({
          where: { name: tag },
          create: { name: tag },
        })),
      },
      categories: {
        connectOrCreate: categories.map((category: string) => ({
          where: { name: category },
          create: { name: category },
        })),
      },
    },
  });
  return NextResponse.json(recipe);
}
