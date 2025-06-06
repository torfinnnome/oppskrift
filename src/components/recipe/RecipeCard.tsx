
"use client";

import type { Recipe } from "@/types";
import Link from "next/link";
import NextImage from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Tag, Bookmark, Globe, Utensils } from "lucide-react"; // Changed Users to Utensils
import { useTranslation } from "@/lib/i18n";

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const { t } = useTranslation();
  const defaultImage = "https://placehold.co/600x400.png";
  const imageUrl = recipe.imageUrl || defaultImage;
  const isDataUrl = imageUrl.startsWith('data:image');

  const displayServingsUnitShort = recipe.servingsUnit === 'pieces' ? t('pieces_short') : t('servings_short');


  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg group">
      <Link href={`/recipes/${recipe.id}`} className="block">
        <CardHeader className="p-0">
          <div className="relative w-full h-48 group-hover:scale-105 transition-transform duration-300">
            {isDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover"
                data-ai-hint="food cooking"
              />
            ) : (
              <NextImage
                src={imageUrl}
                alt={recipe.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                data-ai-hint="food cooking"
              />
            )}
            {recipe.isPublic && (
              <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground p-1.5 rounded-full shadow-md backdrop-blur-sm">
                <Globe className="h-4 w-4" aria-label={t('public_recipe_indicator')} />
              </div>
            )}
          </div>
        </CardHeader>
      </Link>
      <CardContent className="p-4 flex-grow">
        <Link href={`/recipes/${recipe.id}`} className="block">
          <CardTitle className="text-lg font-semibold mb-1 hover:text-primary transition-colors">
            {recipe.title}
          </CardTitle>
        </Link>
        {recipe.description && (
          <CardDescription className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {recipe.description}
          </CardDescription>
        )}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {recipe.categories?.slice(0, 1).map((category) => (
            <Link key={category} href={`/?category=${encodeURIComponent(category)}`} passHref legacyBehavior>
              <a className="no-underline flex items-center">
                <Bookmark className="h-3 w-3 mr-1 text-primary/80" />
                <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/50 border border-transparent transition-colors">
                  {category}
                </Badge>
              </a>
            </Link>
          ))}
          {recipe.tags?.slice(0, 2).map((tag) => (
             <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} passHref legacyBehavior>
              <a className="no-underline flex items-center">
                <Tag className="h-3 w-3 mr-1 text-accent/80" />
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent/10 hover:border-accent/50 border border-transparent transition-colors">
                  {tag}
                </Badge>
              </a>
            </Link>
          ))}
        </div>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <div className="flex justify-between items-center w-full text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Utensils className="h-3 w-3" /> {/* Changed from Users */}
            <span>{recipe.servingsValue} {displayServingsUnitShort}</span>
          </div>
          {(recipe.prepTime || recipe.cookTime) && (
             <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{recipe.prepTime || recipe.cookTime}</span>
             </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
