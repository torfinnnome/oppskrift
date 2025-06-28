
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client"; // Import Prisma types

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    
    select: {
      id: true,
      title: true,
      description: true,
      servingsValue: true,
      servingsUnit: true,
      prepTime: true,
      cookTime: true,
      imageUrl: true,
      sourceUrl: true,
      isPublic: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      averageRating: true,
      numRatings: true,
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
      shareTokens: true,
    },
  });

  if (!recipe) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.json(recipe);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: id },
  });

  if (recipe?.createdBy !== session.user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();

  const {
    ingredientGroups,
    instructions,
    tips,
    tags,
    categories,
    id: recipeId, // Exclude id from update payload
    createdAt, // Exclude createdAt from update payload
    updatedAt, // Exclude updatedAt from update payload
    averageRating, // Exclude averageRating from update payload
    numRatings, // Exclude numRatings from update payload
    ratings, // Exclude ratings from update payload
    ...restOfRecipeData
  } = body;

  // Prepare data for the main recipe update
  const updateData: Prisma.RecipeUpdateInput = {
    ...restOfRecipeData,
  };

  // Handle Tags (many-to-many)
  if (Array.isArray(tags)) {
    updateData.tags = {
      set: tags.map((tagName: string) => ({
        name: tagName,
      })),
    };
  }

  // Handle Categories (many-to-many)
  if (Array.isArray(categories)) {
    updateData.categories = {
      set: categories.map((categoryName: string) => ({
        name: categoryName,
      })),
    };
  }

  // Use a transaction to ensure atomicity for deleting and recreating nested relations
  try {
    const updatedRecipe = await prisma.$transaction(async (tx) => {
      // 1. Delete existing related records for this recipe
      await tx.ingredientGroup.deleteMany({ where: { recipeId: id } });
      await tx.instructionStep.deleteMany({ where: { recipeId: id } });
      await tx.tipStep.deleteMany({ where: { recipeId: id } });

      // 2. Create new related records based on incoming data
      if (Array.isArray(ingredientGroups) && ingredientGroups.length > 0) {
        await tx.ingredientGroup.createMany({
          data: ingredientGroups.map((group: any) => ({
            id: group.id,
            name: group.name,
            recipeId: id, // Link to the current recipe
          })),
        });

        // Now create ingredients for each group
        for (const group of ingredientGroups) {
          if (Array.isArray(group.ingredients) && group.ingredients.length > 0) {
            await tx.ingredient.createMany({
              data: group.ingredients.map((ing: any) => ({
                id: ing.id,
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                ingredientGroupId: group.id, // Link to the parent ingredient group
              })),
            });
          }
        }
      }

      if (Array.isArray(instructions) && instructions.length > 0) {
        await tx.instructionStep.createMany({
          data: instructions.map((step: any) => ({
            id: step.id,
            text: step.text,
            // isChecked is client-side only, do not persist
            recipeId: id, // Link to the current recipe
          })),
        });
      }

      if (Array.isArray(tips) && tips.length > 0) {
        await tx.tipStep.createMany({
          data: tips.map((step: any) => ({
            id: step.id,
            text: step.text,
            // isChecked is client-side only, do not persist
            recipeId: id, // Link to the current recipe
          })),
        });
      }

      // Finally, update the main recipe record with its direct fields and many-to-many relations
      return await tx.recipe.update({
        where: { id: id },
        data: updateData,
      });
    });

    return NextResponse.json(updatedRecipe);
  } catch (error) {
    console.error("Error updating recipe:", error);
    return new NextResponse("Failed to update recipe", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: id },
  });

  if (recipe?.createdBy !== session.user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await prisma.recipe.delete({ where: { id: id } });

  return new NextResponse(null, { status: 204 });
}
