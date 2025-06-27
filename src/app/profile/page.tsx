
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getGravatarUrl } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit } from "lucide-react";

export default function ProfilePage() {
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
      <div className="space-y-6 max-w-lg mx-auto">
        <Skeleton className="h-10 w-1/3" />
        <Card>
          <CardHeader className="items-center flex flex-col gap-2">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const avatarName = user.displayName || user.email || "User";
  const avatarFallback = (user.displayName || user.email || "U").charAt(0).toUpperCase();


  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('profile')}</h1>
        <Button asChild variant="outline">
          <Link href="/profile/edit">
            <Edit className="mr-2 h-4 w-4" />
            {t('edit_profile')}
          </Link>
        </Button>
      </div>
      <Card className="shadow-lg">
        <CardHeader className="items-center text-center">
          <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary ring-offset-2 ring-offset-background" imageSrc={user.email ? getGravatarUrl(user.email, 96) : undefined}>
            <AvatarFallback className="text-3xl">{avatarFallback}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-2xl">{user.displayName || t('user_profile')}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('name')}</p>
            <p className="font-medium">{user.displayName || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('email')}</p>
            <p className="font-medium">{user.email}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
