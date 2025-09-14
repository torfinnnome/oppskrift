import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import RecipeDetailClient from "./RecipeDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: { title: true },
    });

    if (!recipe) {
      return {
        title: "Recipe Not Found",
      };
    }

    return {
      title: recipe.title,
    };
  } catch (error) {
    return {
      title: "Recipe",
    };
  }
}

export default function RecipeDetailPage() {
  return <RecipeDetailClient />;
}