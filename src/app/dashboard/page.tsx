"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
     return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('welcome_back', { name: user.name || user.email })}</CardTitle> {/* Add welcome_back key */}
        </CardHeader>
        <CardContent>
          <p>{t('dashboard_content_placeholder')}</p> {/* Add dashboard_content_placeholder key */}
        </CardContent>
      </Card>
    </div>
  );
}

// Add new locale keys:
// "welcome_back": "Welcome back, {{name}}!"
// "dashboard_content_placeholder": "This is your Oppskrift dashboard. More features coming soon!"
