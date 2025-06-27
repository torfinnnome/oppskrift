
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "@/lib/i18n";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { signIn } from "next-auth/react";

const loginSchema = z.object({
  email: z.string().email({ message: "invalid_email_format" }),
  password: z.string().min(1, { message: "password_required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    const result = await signIn("credentials", {
      redirect: false,
      email: data.email,
      password: data.password,
      callbackUrl: "/", // Redirect to homepage after successful login
    });
    setIsSubmitting(false);

    if (result?.ok) {
      router.push("/");
    } else {
      let errorMessage = t("login_failed_default");
      if (result?.error) {
        // Map NextAuth errors to your translation keys
        switch (result.error) {
          case "CredentialsSignin":
            errorMessage = t("login_failed_invalid_credentials");
            break;
          case "CallbackRouteError":
            errorMessage = t("login_failed_callback_error");
            break;
          // Add more cases for other NextAuth errors if needed
          default:
            errorMessage = t("login_failed_default");
            break;
        }
      }
      toast({
        title: t("login_failed_title"),
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('login')}</CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('email')}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="m@example.com" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.email && t(form.formState.errors.email.message as string)}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.password && t(form.formState.errors.password.message as string)}</FormMessage>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('login')}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="underline hover:text-primary">
              {t('forgot_password_link')}
            </Link>
          </div>
          <div className="mt-4 text-center text-sm">
            {t('no_account_yet')}?{' '}
            <Link href="/signup" className="underline hover:text-primary">
              {t('signup')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
