import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const recipesToImport = await req.json();

  if (!Array.isArray(recipesToImport)) {
    return NextResponse.json({ message: "Invalid data format. Expected an array of recipes." }, { status: 400 });
  }

  let importedCount = 0;
  let skippedCount = 0;
  const userId = session.user.id;

  try {
    for (const recipeData of recipesToImport) {
      // Check for existing recipe by title and createdBy
      const existingRecipe = await prisma.recipe.findFirst({
        where: {
          title: recipeData.title,
          createdBy: userId,
        },
      });

      if (existingRecipe) {
        console.log(`Skipping duplicate recipe: ${recipeData.title}`);
        skippedCount++;
        continue; // Skip to the next recipe
      }

      const { 
        categories, 
        tags, 
        ingredientGroups, 
        instructions, // Use 'instructions' as per Prisma schema
        tips,         // Use 'tips' as per Prisma schema
        id,           // Exclude id from direct creation
        createdAt, 
        updatedAt, 
        ratings,      // Exclude ratings object from direct creation
        createdBy,    // Exclude createdBy string from direct creation
        ingredients,  // Exclude top-level ingredients field
        shareTokens,  // Exclude shareTokens from direct creation
        ...rest       // Remaining direct fields
      } = recipeData;

      const dataToCreate: any = {
        ...rest,
        createdBy: userId, // Connect to the current authenticated user
        createdAt: new Date(createdAt || Date.now()),
        updatedAt: new Date(updatedAt || Date.now()),
      };

      if (categories && Array.isArray(categories)) {
        dataToCreate.categories = {
          connectOrCreate: categories.map((cat: string) => ({
            where: { name: cat },
            create: { name: cat },
          })),
        };
      }

      if (tags && Array.isArray(tags)) {
        dataToCreate.tags = {
          connectOrCreate: tags.map((tag: string) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        };
      }

      if (ingredientGroups && Array.isArray(ingredientGroups)) {
        dataToCreate.ingredientGroups = {
          create: ingredientGroups.map((group: any) => ({
            name: group.name,
            ingredients: {
              create: group.ingredients?.map((ing: any) => ({
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
              })),
            },
          })),
        };
      }

      if (instructions && Array.isArray(instructions)) {
        dataToCreate.instructions = {
          create: instructions.map((step: any) => ({
            text: step.text,
          })),
        };
      }

      if (tips && Array.isArray(tips)) {
        dataToCreate.tips = {
          create: tips.map((tip: any) => ({
            text: tip.text,
          })),
        };
      }

      if (shareTokens?.length > 0) {
        dataToCreate.shareTokens = {
          create: shareTokens.map((token: any) => ({
            token: token.token,
            expiresAt: new Date(token.expiresAt.seconds * 1000 + token.expiresAt.nanoseconds / 1000000),
            createdAt: new Date(token.createdAt.seconds * 1000 + token.createdAt.nanoseconds / 1000000),
            sharedBy: token.sharedBy,
          })),
        };
      }

      await prisma.recipe.create({
        data: dataToCreate,
      });
      importedCount++;
    }

    return NextResponse.json({ message: "Recipes imported successfully", count: importedCount, skippedCount: skippedCount }, { status: 200 });
  } catch (error) {
    console.error("Error importing recipes:", error);
    return NextResponse.json({ message: "Error importing recipes." }, { status: 500 });
  }
}
