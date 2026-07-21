"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, Bookmark, X, PlusCircle, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export interface CategoryTagComboboxProps {
  type: "category" | "tag";
  value: string[];
  onChange: (value: string[]) => void;
  existingItems: { id: string; name: string; count: number }[];
  loading?: boolean;
}

export function CategoryTagCombobox({
  type,
  value,
  onChange,
  existingItems,
  loading = false,
}: CategoryTagComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const sortedItems = useMemo(() => {
    return [...existingItems].sort((a, b) => b.count - a.count);
  }, [existingItems]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return sortedItems;
    const q = search.toLowerCase();
    return sortedItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [sortedItems, search]);

  const hasUnmatchedSearch = useMemo(() => {
    if (!search.trim()) return false;
    const q = search.toLowerCase();
    return !existingItems.some((item) => item.name.toLowerCase() === q);
  }, [existingItems, search]);

  const toggleItem = useCallback(
    (name: string) => {
      onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
    },
    [value, onChange],
  );

  const removeItem = useCallback(
    (name: string) => {
      onChange(value.filter((v) => v !== name));
    },
    [value, onChange],
  );

  const addItem = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setSearch("");
      setOpen(false);
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && hasUnmatchedSearch) {
        e.preventDefault();
        addItem(search);
      }
    },
    [hasUnmatchedSearch, search, addItem],
  );

  const Icon = type === "category" ? Bookmark : Tag;
  const labelKey = type === "category" ? "categories" : "tags";
  const placeholderKey = type === "category" ? "categories_placeholder" : "tags_placeholder";
  const searchPlaceholderKey = type === "category" ? "search_categories" : "search_tags";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start min-h-[2.5rem] px-3 py-2 flex-wrap gap-1.5",
            value.length === 0 && "text-muted-foreground",
          )}
        >
          {value.length === 0 ? (
            <span className="flex items-center gap-1.5">
              <Icon className="h-4 w-4 shrink-0" />
              {t(placeholderKey)}
            </span>
          ) : (
            <>
              {value.map((item) => (
                <Badge
                  key={item}
                  variant="secondary"
                  className="gap-1 pr-1 max-w-full"
                >
                  <span className="truncate">{item}</span>
                  <button
                    type="button"
                    className="ml-0.5 rounded-full hover:bg-muted/80 p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item);
                    }}
                    aria-label={`Remove ${item}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {value.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  {t("selected_count", { count: value.length })}
                </span>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              placeholder={t(searchPlaceholderKey)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm border-0 shadow-none focus-visible:ring-0"
            />
            {search && (
              <button
                type="button"
                className="shrink-0 p-1 hover:bg-muted rounded"
                onClick={() => setSearch("")}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-60">
          <div className="p-1">
            {loading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t("loading_options")}
              </p>
            ) : (
              <>
                {filteredItems.length === 0 && !hasUnmatchedSearch && (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    {t("no_matches")}
                  </p>
                )}

                {filteredItems.map((item) => {
                  const isSelected = value.includes(item.name);
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm",
                        "hover:bg-muted/50",
                        isSelected && "bg-muted/50",
                      )}
                      onClick={() => toggleItem(item.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleItem(item.name);
                        }
                      }}
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1 truncate">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({item.count})
                      </span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })}

                {hasUnmatchedSearch && (
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm text-primary hover:bg-muted/50 mt-1"
                    onClick={() => addItem(search)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        addItem(search);
                      }
                    }}
                  >
                    <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {t("create_new_x", { name: search.trim() })}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-2 text-xs text-muted-foreground flex justify-between">
          <span>{t(labelKey)}</span>
          <span>{value.length} / {existingItems.length}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
