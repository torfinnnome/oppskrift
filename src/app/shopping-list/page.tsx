"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useShoppingList } from "@/contexts/ShoppingListContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Copy, Download, Trash2, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ShoppingListPage() {
  const { user, loading: authLoading } = useAuth();
  const { items: shoppingItems, toggleItemChecked, removeItem, clearList, loading: shoppingListLoading } = useShoppingList();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const handleClearList = () => {
    clearList();
    toast({ title: t('shopping_list_cleared') });
  };

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
    toast({ title: t('item_removed_from_shopping_list') });
  };
  
  const isLoading = authLoading || shoppingListLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('shopping_list')}</h1>
        {shoppingItems.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" /> {t('clear_shopping_list')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirm_clear_list_title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('confirm_clear_list_desc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearList}>{t('delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('your_consolidated_list')}</CardTitle>
          <CardDescription>{t('shopping_list_desc_placeholder')}</CardDescription>
        </CardHeader>
        <CardContent>
          {shoppingItems.length > 0 ? (
            <ul className="space-y-3 divide-y divide-border -mx-6">
              {shoppingItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-3 px-6 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`item-${item.id}`}
                      checked={item.isChecked}
                      onCheckedChange={() => toggleItemChecked(item.id)}
                      aria-label={item.isChecked ? t('mark_as_unchecked') : t('mark_as_checked')}
                    />
                    <label
                      htmlFor={`item-${item.id}`}
                      className={`font-medium ${item.isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {item.name}
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`text-sm ${item.isChecked ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>
                      {item.quantity} {item.unit}
                      {item.recipeTitle && <span className="text-xs block">({t('from_recipe')}: {item.recipeTitle})</span>}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} aria-label={t('remove_item')}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-center py-6">{t('no_items_in_shopping_list')}</p>
          )}
          
          <div className="mt-8 flex flex-wrap gap-2 border-t pt-6">
            <Button variant="outline" disabled={shoppingItems.length === 0}><Printer className="mr-2 h-4 w-4" /> {t('print_list')}</Button>
            <Button variant="outline" disabled={shoppingItems.length === 0}><Copy className="mr-2 h-4 w-4" /> {t('copy_list')}</Button>
            <Button variant="outline" disabled={shoppingItems.length === 0}><Download className="mr-2 h-4 w-4" /> {t('export_list')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
