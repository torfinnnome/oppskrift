
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRecipes } from "@/contexts/RecipeContext"; // Import useRecipes
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react"; // Added useState, useRef
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button"; // Import Button
import { Input } from "@/components/ui/input"; // Import Input
import { toast } from "@/hooks/use-toast"; // Import toast
import { Download, Upload, Loader2 } from "lucide-react"; // Import icons

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { exportUserRecipes, importRecipes, loading: recipesLoading } = useRecipes(); // Get recipe context functions
  const router = useRouter();
  const { t } = useTranslation();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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

  const handleExport = async () => {
    setIsExporting(true);
    const result = await exportUserRecipes();
    if (result.success) {
      toast({ title: t('recipes_exported_successfully') });
    } else {
      toast({ title: t('error_exporting_recipes'), description: result.error || t('error_generic_title'), variant: "destructive" });
    }
    setIsExporting(false);
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
        } else {
          toast({ title: t('error_importing_recipes'), description: result.error || t('invalid_json_file_format'), variant: "destructive" });
        }
      } else {
        toast({ title: t('error_reading_file'), variant: "destructive" });
      }
      setIsImporting(false);
      setSelectedFile(null); // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear the file input display
      }
    };
    reader.onerror = () => {
      toast({ title: t('error_reading_file'), variant: "destructive" });
      setIsImporting(false);
    };
    reader.readAsText(selectedFile);
  };

  if (authLoading || !user) { // recipesLoading isn't strictly needed for initial page skeleton
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
            <Button onClick={handleExport} disabled={isExporting || recipesLoading}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? t('exporting') : t('export_my_recipes_button')}
            </Button>
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
    </div>
  );
}
