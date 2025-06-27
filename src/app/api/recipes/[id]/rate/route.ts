import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  const { id: recipeId } = context.params;
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { userId, rating } = await req.json();

  if (!userId || typeof rating !== "number" || rating < 0 || rating > 5) { // Allow rating 0 for removal
    return new NextResponse("Invalid request data", { status: 400 });
  }

  try {
    if (rating === 0) {
      // If rating is 0, delete the existing rating
      await prisma.rating.deleteMany({
        where: {
          userId: userId,
          recipeId: recipeId,
        },
      });
    } else {
      // Check if the user has already rated this recipe
      const existingRating = await prisma.rating.findUnique({
        where: {
          userId_recipeId: {
            userId: userId,
            recipeId: recipeId,
          },
        },
      });

      if (existingRating) {
        // Update existing rating
        await prisma.rating.update({
          where: {
            userId_recipeId: {
              userId: userId,
              recipeId: recipeId,
            },
          },
          data: { value: rating },
        });
      } else {
        // Create new rating
        await prisma.rating.create({
          data: {
            userId: userId,
            recipeId: recipeId,
            value: rating,
          },
        });
      }
    }

    // Recalculate average rating and number of ratings for the recipe
    const ratings = await prisma.rating.findMany({
      where: { recipeId: recipeId },
      select: { value: true },
    });

    const numRatings = ratings.length;
    const totalRating = ratings.reduce((sum: number, r: { value: number }) => sum + r.value, 0);
    const averageRating = numRatings > 0 ? totalRating / numRatings : 0;

    await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        averageRating: averageRating,
        numRatings: numRatings,
      },
    });

    return new NextResponse("Rating submitted successfully", { status: 200 });
  } catch (error) {
    console.error("Error submitting rating:", error);
    return new NextResponse("Failed to submit rating", { status: 500 });
  }
}