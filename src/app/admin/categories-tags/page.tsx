"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Pencil, Merge, Trash2, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CategoryTagItem {
  id: string;
  name: string;
  createdAt: string;
  count: number;
  type: "category" | "tag";
}

export default function AdminCategoriesTagsPage() {
  const { user: currentUser, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const [items, setItems] = useState<CategoryTagItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "category" | "tag" | "orphan">("all");

  const [renameItemId, setRenameItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeLoading, setMergeLoading] = useState(false);

  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deletingItemName, setDeletingItemName] = useState("");
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isAdmin) {
        router.replace("/");
      }
    }
  }, [currentUser, isAdmin, authLoading, router]);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/categories-tags");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems([...data.categories, ...data.tags]);
    } catch (err) {
      console.error("Error fetching categories/tags:", err);
      toast({
        title: t("error_generic_title"),
        description: t("error_generic_desc"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) fetchItems();
  }, [isAdmin, fetchItems]);

  const filteredItems = items.filter((item) => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (typeFilter === "category") return item.type === "category";
    if (typeFilter === "tag") return item.type === "tag";
    if (typeFilter === "orphan") return item.count === 0;
    return true;
  });

  const handleRename = async () => {
    if (!renameItemId || !renameValue.trim()) return;
    setRenameLoading(true);
    try {
      const res = await fetch(`/api/admin/categories-tags/${renameItemId}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Rename failed");
      }
      toast({ title: t("rename_item"), description: `${t("name")} updated to "${renameValue.trim()}"` });
      setRenameItemId(null);
      await fetchItems();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: (err instanceof Error ? err.message : t("error_generic_desc")),
        variant: "destructive",
      });
    } finally {
      setRenameLoading(false);
    }
  };

  const mergeCandidates = items.filter(
    (it) => it.id !== mergeSourceId && it.type === items.find((i) => i.id === mergeSourceId)?.type
  );

  const handleMerge = async () => {
    if (!mergeSourceId || !mergeTargetId) return;
    setMergeLoading(true);
    try {
      const res = await fetch(`/api/admin/categories-tags/${mergeSourceId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeTargetId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Merge failed");
      }
      toast({ title: t("merge_item"), description: "Items merged successfully." });
      setMergeSourceId(null);
      await fetchItems();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: (err instanceof Error ? err.message : t("error_generic_desc")),
        variant: "destructive",
      });
    } finally {
      setMergeLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItemId) return;
    setDeletingLoading(true);
    try {
      const res = await fetch(`/api/admin/categories-tags/${deletingItemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Delete failed");
      }
      toast({ title: t("delete_item"), description: `"${deletingItemName}" deleted successfully.` });
      setDeletingItemId(null);
      setDeletingItemName("");
      await fetchItems();
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: (err instanceof Error ? err.message : t("error_generic_desc")),
        variant: "destructive",
      });
    } finally {
      setDeletingLoading(false);
    }
  };

  if (authLoading || (!isAdmin && currentUser)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t("loading_auth_status")}</p>
      </div>
    );
  }

  if (!isAdmin && !authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <h1 className="text-2xl font-bold mb-2">{t("access_denied_title")}</h1>
        <p className="text-muted-foreground">{t("admin_only_area_desc")}</p>
        <Button onClick={() => router.push("/")} className="mt-6">{t("go_to_homepage")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>{t("admin_categories_tags")}</CardTitle>
          <CardDescription>{t("admin_categories_tags_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-b">
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("search_placeholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_types")}</SelectItem>
                    <SelectItem value="category">{t("categories")}</SelectItem>
                    <SelectItem value="tag">{t("tags")}</SelectItem>
                    <SelectItem value="orphan">{t("orphan")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredItems.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("no_items_found")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("item_type")}</TableHead>
                      <TableHead>{t("recipes_count")}</TableHead>
                      <TableHead>{t("created")}</TableHead>
                      <TableHead className="text-right">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <Link href={`/?${item.type === "category" ? "category" : "tag"}=${encodeURIComponent(item.name)}`} className="text-primary hover:underline">
                            {item.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.type === "category" ? "default" : "secondary"}>
                            {item.type === "category" ? t("category") : t("tag")}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.count}</TableCell>
                        <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* Rename Dialog */}
                            <Dialog
                              open={renameItemId === item.id}
                              onOpenChange={(open) => {
                                if (!open) setRenameItemId(null);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => { setRenameItemId(item.id); setRenameValue(item.name); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>{t("rename_item")}: {item.name}</DialogTitle>
                                  <DialogDescription>{t("new_name")}</DialogDescription>
                                </DialogHeader>
                                <Input
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRename();
                                  }}
                                  autoFocus
                                />
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">{t("cancel")}</Button>
                                  </DialogClose>
                                  <Button onClick={handleRename} disabled={renameLoading || !renameValue.trim()}>
                                    {renameLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t("save_changes")}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Merge Dialog */}
                            <Dialog
                              open={mergeSourceId === item.id}
                              onOpenChange={(open) => {
                                if (!open) setMergeSourceId(null);
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => { setMergeSourceId(item.id); setMergeTargetId(""); }}>
                                  <Merge className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>{t("merge_item")}</DialogTitle>
                                  <DialogDescription>
                                    {t("merge_confirm_message")
                                      .replaceAll("{{source}}", item.name)
                                      .replaceAll("{{target}}", mergeCandidates.find((c) => c.id === mergeTargetId)?.name || "???")}
                                  </DialogDescription>
                                </DialogHeader>
                                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t("merge_item")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {mergeCandidates.map((cand) => (
                                      <SelectItem key={cand.id} value={cand.id}>
                                        {cand.name} ({cand.count} {t("recipes_count").toLowerCase()})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">{t("cancel")}</Button>
                                  </DialogClose>
                                  <Button onClick={handleMerge} disabled={mergeLoading || !mergeTargetId}>
                                    {mergeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t("merge_item")}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Delete AlertDialog */}
                            {item.count === 0 ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" onClick={() => {
                                    setDeletingItemId(item.id);
                                    setDeletingItemName(item.name);
                                  }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t("delete_item")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {t("delete_confirm_message").replace("{{name}}", item.name)}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={handleDelete}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {deletingLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      {t("delete")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <span className="text-xs text-muted-foreground">{t("cannot_delete_has_recipes")}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
