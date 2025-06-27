
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRecipes } from "@/contexts/RecipeContext"; 
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react"; 
import { useTranslation } from "@/lib/i18n";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button"; 
import { Input } from "@/components/ui/input"; 
import { toast } from "@/hooks/use-toast"; 
import { Download, Upload, Loader2, FileText, FileCode } from "lucide-react"; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { exportUserRecipes, importRecipes, exportUserRecipesAsHTML, exportUserRecipesAsMarkdown, loading: recipesLoading } = useRecipes(); 
  const router = useRouter();
  const { t } = useTranslation();
  const { update: updateSession } = useSession();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const [isExportingMarkdown, setIsExportingMarkdown] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [exportContentType, setExportContentType] = useState<"html" | "markdown" | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleExportJson = async () => {
    setIsExportingJson(true);
    const result = await exportUserRecipes();
    if (result.success) {
      toast({ title: t('recipes_exported_successfully') });
    } else {
      toast({ title: t('error_exporting_recipes'), description: result.error || t('error_generic_title'), variant: "destructive" });
    }
    setIsExportingJson(false);
  };

  const handleExportHtml = async () => {
    setIsExportingHtml(true);
    const result = await exportUserRecipesAsHTML();
    if (result.success && result.content) {
      setExportContent(result.content);
      setExportContentType("html");
      setShowExportDialog(true);
    } else {
      toast({ title: t('error_exporting_html'), description: result.error || t('error_generic_title'), variant: "destructive" });
    }
    setIsExportingHtml(false);
  };

  const handleExportMarkdown = async () => {
    setIsExportingMarkdown(true);
    const result = await exportUserRecipesAsMarkdown();
    if (result.success && result.content) {
      setExportContent(result.content);
      setExportContentType("markdown");
      setShowExportDialog(true);
    } else {
      toast({ title: t('error_exporting_markdown'), description: result.error || t('error_generic_title'), variant: "destructive" });
    }
    setIsExportingMarkdown(false);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({ title: t('no_file_selected'), variant: "destructive" });
      return;
    }
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const jsonString = e.target?.result as string;
      if (jsonString) {
        const result = await importRecipes(jsonString);
        if (result.success) {
          toast({ title: t('recipes_imported_successfully_count', { count: result.count }) });
          if (result.skippedCount && result.skippedCount > 0) {
            toast({ title: t('recipes_skipped_duplicates', { count: result.skippedCount }), variant: "info" });
          }
          updateSession(); // Re-fetch session after successful import
        } else {
          toast({ title: t('error_importing_recipes'), description: result.error || t('invalid_json_file_format'), variant: "destructive" });
        }
      } else {
        toast({ title: t('error_reading_file'), variant: "destructive" });
      }
      setIsImporting(false);
      setSelectedFile(null); 
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
    };
    reader.onerror = () => {
      toast({ title: t('error_reading_file'), variant: "destructive" });
      setIsImporting(false);
    };
    reader.readAsText(selectedFile);
  };

  const anyExportInProgress = isExportingJson || isExportingHtml || isExportingMarkdown;

  if (authLoading || !user) { 
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold">{t('settings')}</h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('app_preferences')}</CardTitle>
          <CardDescription>{t('manage_your_app_settings')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="language-switcher-container" className="text-base font-medium">{t('language')}</Label>
            <div id="language-switcher-container">
              <LanguageSwitcher />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme-toggle-container" className="text-base font-medium">{t('theme')}</Label>
            <div id="theme-toggle-container">
              <ThemeToggle />
            </div>
            <p className="text-sm text-muted-foreground">{t('choose_display_language')}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('data_management')}</CardTitle>
          <CardDescription>{t('data_management_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">{t('export_my_recipes')}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t('export_recipes_description')}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExportJson} disabled={anyExportInProgress || recipesLoading}>
                {isExportingJson ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isExportingJson ? t('exporting') : t('export_my_recipes_button')}
              </Button>
              <Button onClick={handleExportHtml} disabled={anyExportInProgress || recipesLoading} variant="outline">
                {isExportingHtml ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCode className="mr-2 h-4 w-4" />}
                {isExportingHtml ? t('exporting_html') : t('export_all_html')}
              </Button>
              <Button onClick={handleExportMarkdown} disabled={anyExportInProgress || recipesLoading} variant="outline">
                {isExportingMarkdown ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                {isExportingMarkdown ? t('exporting_markdown') : t('export_all_markdown')}
              </Button>
            </div>
          </div>
          <hr className="my-6" />
          <div>
            <h3 className="text-lg font-medium mb-2">{t('import_recipes')}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t('import_recipes_description')}</p>
            <div className="space-y-3">
              <Input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="max-w-xs"
                aria-label={t('select_json_file')}
              />
              <Button onClick={handleImport} disabled={!selectedFile || isImporting || recipesLoading}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isImporting ? t('importing') : t('import_recipes_button')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('exported_content')}</DialogTitle>
            <DialogDescription>
              {exportContentType === "html" ? t('copy_html_content') : t('copy_markdown_content')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-auto rounded-md bg-gray-100 p-4 font-mono text-sm text-gray-800">
            {exportContentType === "html" ? (
              <div dangerouslySetInnerHTML={{ __html: exportContent }} />
            ) : (
              <pre className="whitespace-pre-wrap break-words">{exportContent}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
