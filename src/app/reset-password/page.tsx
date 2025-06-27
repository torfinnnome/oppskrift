
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { Loader2, KeyRound } from "lucide-react";
import Link from "next/link";
// import { auth as firebaseAuth } from "@/firebase"; // Import Firebase auth
// import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";

const passwordResetSchemaFactory = (t: (key: string, params?: any) => string) => z.object({
  newPassword: z.string().min(6, { message: t("password_min_length", {length: 6}) }),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: t("new_passwords_do_not_match"),
  path: ["confirmNewPassword"],
});

type PasswordResetFormValues = z.infer<ReturnType<typeof passwordResetSchemaFactory>>;

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  
  const token = searchParams.get("token");

  const passwordResetSchema = passwordResetSchemaFactory(t);
  const form = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  // useEffect(() => {
  //   async function checkToken() {
  //     if (!oobCode) {
  //       setTokenError(t("firebase_auth_errors.auth/missing-action-code", t("missing_reset_token")));
  //       setIsLoadingToken(false);
  //       setTokenVerified(false);
  //       return;
  //     }
  //     try {
  //       // Verify the password reset code. 
  //       // This checks if the code is valid and not expired.
  //       // It also returns the email of the user if the code is valid.
  //       await verifyPasswordResetCode(firebaseAuth, oobCode);
  //       setTokenVerified(true);
  //     } catch (error: any) {
  //       console.error("Firebase verifyPasswordResetCode error:", error);
  //       setTokenError(t(`firebase_auth_errors.${error.code}`, t("invalid_or_expired_token")));
  //       setTokenVerified(false);
  //     } finally {
  //       setIsLoadingToken(false);
  //     }
  //   }
  //   checkToken();
  // }, [oobCode, t]);

  // Temporarily set tokenVerified to true for testing purposes
  useEffect(() => {
    if (token) {
      setTokenVerified(true);
    } else {
      setTokenError(t("missing_reset_token"));
    }
    setIsLoadingToken(false);
  }, [token, t]);

  const onSubmit = async (data: PasswordResetFormValues) => {
    if (!token || !tokenVerified) {
      toast({ title: t("error_generic_title"), description: t("invalid_or_expired_token"), variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, newPassword: data.newPassword }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({ title: t("password_reset_success_title"), description: t("password_reset_success_desc") });
        router.push("/login");
      } else {
        setTokenError(result.message || t("invalid_or_expired_token"));
        toast({ title: t("error_generic_title"), description: result.message || t("error_updating_password_locally"), variant: "destructive"});
        setTokenVerified(false); // Invalidate the form effectively
      }
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({ title: t("error_generic_title"), description: t("error_updating_password_locally"), variant: "destructive"});
      setTokenError(t("invalid_or_expired_token")); // Show error and disable form
      setTokenVerified(false); // Invalidate the form effectively
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingToken) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('verifying_reset_token')}</p>
      </div>
    );
  }

  if (!tokenVerified || tokenError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-destructive">{t('reset_token_invalid_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{tokenError || t("invalid_or_expired_token")}</p>
            <Button asChild>
              <Link href="/forgot-password">{t('request_new_reset_link')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('reset_your_password')}</CardTitle>
          
          <CardDescription>
            {t('reset_password_page_description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('new_password')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.newPassword && t(form.formState.errors.newPassword.message as string)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmNewPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('confirm_new_password')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.confirmNewPassword && t(form.formState.errors.confirmNewPassword.message as string)}</FormMessage>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {t('reset_password_button')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
