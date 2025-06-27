
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
import { signup } from "./actions";

const signupSchemaFactory = (t: (key: string, params?: any) => string) => z.object({
  displayName: z.string().min(2, { message: t("name_min_length", {length: 2}) }).optional(),
  email: z.string().email({ message: t("invalid_email_format") }),
  password: z.string().min(6, { message: t("password_min_length", {length: 6}) }),
});

type SignupFormValues = z.infer<ReturnType<typeof signupSchemaFactory>>;

export default function SignupPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const signupSchema = signupSchemaFactory(t);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    if (data.displayName) {
      formData.append("displayName", data.displayName);
    }

    const result = await signup(formData);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: t("signup_success_title"),
        description: t("signup_success_description"),
      });
      router.push("/login");
    } else {
      let errorMessage = t("signup_failed_default");
      if (result.error) {
        switch (result.error) {
          case "auth/email-already-in-use":
            errorMessage = t("signup_failed_email_already_in_use");
            break;
          default:
            errorMessage = t("signup_failed_default");
            break;
        }
      }
      toast({
        title: t("signup_failed_title"),
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('signup')}</CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
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
                {t('signup')}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            {t('already_have_account')}?{' '}
            <Link href="/login" className="underline hover:text-primary">
              {t('login')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
