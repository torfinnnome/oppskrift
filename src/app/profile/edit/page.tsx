
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const profileEditSchemaFactory = (t: (key: string, params?:any) => string, initialEmail?: string | null) => z.object({
  displayName: z.string().min(1, { message: t("name_required") }).optional().or(z.literal('')),
  email: z.string().email({ message: t("invalid_email_format") }).optional().or(z.literal('')),
  currentPassword: z.string().optional().or(z.literal('')),
  newPassword: z.string().min(6, { message: t("password_min_length", {length: 6}) }).optional().or(z.literal('')),
  confirmNewPassword: z.string().optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.newPassword && data.newPassword !== data.confirmNewPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("new_passwords_do_not_match"),
      path: ["confirmNewPassword"],
    });
  }
  if (data.newPassword && !data.confirmNewPassword) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("please_confirm_new_password"),
        path: ["confirmNewPassword"],
    });
  }
  const emailIsBeingChanged = initialEmail && data.email && data.email !== initialEmail;
  if ((emailIsBeingChanged || data.newPassword) && !data.currentPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: t("current_password_required_for_change"),
      path: ["currentPassword"],
    });
  }
});


type ProfileEditFormValues = z.infer<ReturnType<typeof profileEditSchemaFactory>>;

export default function EditProfilePage() {
  const { user, loading, updateUserProfile } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profileEditSchema = profileEditSchemaFactory(t, user?.email);

  const form = useForm<ProfileEditFormValues>({
    resolver: zodResolver(profileEditSchema),
    // Default values will be set in useEffect once user data is available
  });
  
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
    if (user) {
      form.reset({
        displayName: user.displayName || "",
        email: user.email || "",
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    }
  }, [user, loading, router, form]);


  const onSubmit = async (data: ProfileEditFormValues) => {
    if (!user) return;
    setIsSubmitting(true);

    const updates: { displayName?: string; email?: string; newPassword?: string } = {};
    if (data.displayName !== undefined && data.displayName !== (user.displayName || "")) updates.displayName = data.displayName;
    if (data.email && data.email !== user.email) updates.email = data.email;
    if (data.newPassword) updates.newPassword = data.newPassword;
    
    const result = await updateUserProfile(updates, data.currentPassword);

    if (result.success) {
      toast({ title: t("profile_updated_successfully") });
      form.reset({ // Reset form with potentially new values and clear passwords
        displayName: user?.displayName || "", // Use updated user from context if available, or fallback
        email: user?.email || "",
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      router.push("/profile");
    } else {
      const errorMessage = result.errorCode ? t(`firebase_auth_errors.${result.errorCode}`, t('error_updating_profile')) : t('error_updating_profile');
      toast({
        title: t("error_updating_profile"),
        description: errorMessage,
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  if (loading || !user) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{t('edit_profile')}</CardTitle>
          <CardDescription>{t('profile_edit_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('name_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.displayName && t(form.formState.errors.displayName.message as string)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="m@example.com" {...field} />
                    </FormControl>
                     <FormDescription>{t('email_change_requires_current_password')}</FormDescription>
                    <FormMessage>{form.formState.errors.email && t(form.formState.errors.email.message as string)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('current_password')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormDescription>{t('password_change_requires_current')}</FormDescription>
                    <FormMessage>{form.formState.errors.currentPassword && t(form.formState.errors.currentPassword.message as string)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('new_password')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                     <FormDescription>{t('leave_blank_to_keep_same')}</FormDescription>
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
              <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
                {(isSubmitting || loading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {t('update_profile')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
