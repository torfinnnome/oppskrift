"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, X, ListFilter, Tag, FolderOpen, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface CategoryTagSelectorProps {
  availableCategories: string[];
  availableTags: string[];
  selectedCategories: string[];
  selectedTags: string[];
  onChange: (categories: string[], tags: string[]) => void;
  loading?: boolean;
}

type Section = "categories" | "tags";

function SectionList({
  section,
  items,
  selected,
  onToggle,
}: {
  section: Section;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, search]);

  const placeholderKey =
    section === "categories" ? "planner_search_categories" : "planner_search_tags";
  const headingKey =
    section === "categories" ? "planner_categories" : "planner_tags";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {section === "categories" ? (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Tag className="h-4 w-4 text-muted-foreground" />
        )}
        <Label className="text-sm font-semibold">{t(headingKey)}</Label>
        <span className="text-xs text-muted-foreground ml-auto">
          {selected.length}
        </span>
      </div>

      <Input
        ref={inputRef}
        placeholder={t(placeholderKey)}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />

      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {search.trim()
              ? t("planner_no_matches")
              : t("planner_no_options")}
          </p>
        )}
        {filtered.map((item) => {
          const isSelected = selected.includes(item);
          return (
            <div
              key={item}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
              onClick={() => onToggle(item)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(item)}
                id={`${section}-${item}`}
              />
              <label
                htmlFor={`${section}-${item}`}
                className="text-sm flex-1 cursor-pointer truncate"
              >
                {item}
              </label>
              {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryTagSelector({
  availableCategories,
  availableTags,
  selectedCategories,
  selectedTags,
  onChange,
  loading = false,
}: CategoryTagSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const totalCount = selectedCategories.length + selectedTags.length;

  const handleCategoryToggle = (item: string) => {
    const next = selectedCategories.includes(item)
      ? selectedCategories.filter((c) => c !== item)
      : [...selectedCategories, item];
    onChange(next, selectedTags);
  };

  const handleTagToggle = (item: string) => {
    const next = selectedTags.includes(item)
      ? selectedTags.filter((t) => t !== item)
      : [...selectedTags, item];
    onChange(selectedCategories, next);
  };

  const removeCategory = (item: string) => {
    onChange(selectedCategories.filter((c) => c !== item), selectedTags);
  };

  const removeTag = (item: string) => {
    onChange(selectedCategories, selectedTags.filter((t) => t !== item));
  };

  const clearAll = () => {
    onChange([], []);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ListFilter className="h-4 w-4 animate-spin" />
        {t("planner_loading_options")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedCategories.map((cat) => (
          <Badge
            key={cat}
            variant="secondary"
            className="gap-1 pr-1.5 cursor-default"
          >
            <FolderOpen className="h-3 w-3" />
            {cat}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeCategory(cat);
              }}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {selectedTags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="gap-1 pr-1.5 cursor-default"
          >
            <Tag className="h-3 w-3" />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1 h-7 text-xs",
                totalCount > 0 && "border-primary/50"
              )}
            >
              <ListFilter className="h-3.5 w-3.5" />
              {totalCount > 0
                ? `${t("planner_filtering")}: ${totalCount}`
                : t("planner_select_filters")}
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-4">
              {/* Header with clear button */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {t("planner_select_filters")}
                </span>
                {totalCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={clearAll}
                  >
                    {t("planner_clear_all")}
                  </Button>
                )}
              </div>

              <SectionList
                section="categories"
                items={availableCategories}
                selected={selectedCategories}
                onToggle={handleCategoryToggle}
              />

              <div className="border-t pt-3">
                <SectionList
                  section="tags"
                  items={availableTags}
                  selected={selectedTags}
                  onToggle={handleTagToggle}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Empty state hint */}
      {totalCount === 0 && (
        <p className="text-xs text-muted-foreground">
          {t("planner_select_hint")}
        </p>
      )}
    </div>
  );
}
