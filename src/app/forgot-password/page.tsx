
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth for sendUserPasswordResetEmail

const forgotPasswordSchemaFactory = (t: (key: string) => string) => z.object({
  email: z.string().email({ message: t("invalid_email_format") }),
});

type ForgotPasswordFormValues = z.infer<ReturnType<typeof forgotPasswordSchemaFactory>>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { sendUserPasswordResetEmail } = useAuth(); // Get the Firebase method
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const forgotPasswordSchema = forgotPasswordSchemaFactory(t);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    setFormError(null);

    const result = await sendUserPasswordResetEmail(data.email);

    if (result.success) {
      toast({
        title: t("password_reset_email_sent_title"),
        description: t("password_reset_email_sent_desc", { email: data.email }),
      });
      form.reset();
    } else {
      const errorMessage = result.errorCode ? t(`firebase_auth_errors.${result.errorCode}`, t('error_sending_email')) : t('error_sending_email');
      setFormError(errorMessage);
      toast({
        title: t("error_sending_email_title"),
        description: errorMessage,
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{t('forgot_password_title')}</CardTitle>
          <CardDescription>
            {t('forgot_password_page_description')}
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
              {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {t('send_reset_link')}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="underline hover:text-primary">
              {t('back_to_login')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
