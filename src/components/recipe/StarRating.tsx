
"use client";

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface StarRatingProps {
  rating: number;
  totalStars?: number;
  onRate?: (rating: number) => void;
  interactive?: boolean;
  size?: number;
  className?: string;
  showTooltip?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  totalStars = 5,
  onRate,
  interactive = true,
  size = 20,
  className,
  showTooltip = true,
}) => {
  const { t } = useTranslation();
  const [hoverRating, setHoverRating] = useState(0);

  const handleMouseOver = (index: number) => {
    if (!interactive) return;
    setHoverRating(index);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    setHoverRating(0);
  };

  const handleClick = (index: number) => {
    if (!interactive || !onRate) return;
    // If clicking the same star as the current rating, clear it (send 0)
    if (index === rating) {
      onRate(0);
    } else {
      onRate(index);
    }
  };

  return (
    <div className={cn("flex items-center space-x-1", className)} aria-label={t('star_rating_aria_label', {count: totalStars })}>
      {[...Array(totalStars)].map((_, i) => {
        const starValue = i + 1;
        // isFilled is true if the star is part of the current rating or current hover action
        const isFilled = starValue <= (hoverRating || rating);
        
        const starTitleKey = starValue === rating && interactive 
          ? 'clear_rating_tooltip' 
          : 'star_label';
        const starTitle = showTooltip ? t(starTitleKey, { count: starValue }) : undefined;


        return (
          <button
            key={starValue}
            type="button"
            onClick={() => handleClick(starValue)}
            onMouseOver={() => handleMouseOver(starValue)}
            onMouseLeave={handleMouseLeave}
            disabled={!interactive}
            className={cn(
              "p-0 bg-transparent border-none",
              interactive ? "cursor-pointer" : "cursor-default",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
            )}
            aria-label={t('star_label', { count: starValue })} // General label for accessibility
            title={starTitle}
          >
            <Star
              size={size}
              className={cn(
                'transition-colors duration-150 ease-in-out',
                isFilled
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-muted-foreground/40 fill-muted-foreground/10',
                interactive && (starValue <= rating) && 'hover:opacity-80'
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

