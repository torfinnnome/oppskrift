"use client";

import React, { type ReactNode } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RecipeProvider } from "@/contexts/RecipeContext";
import { ShoppingListProvider } from "@/contexts/ShoppingListContext";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { AuthWrapper } from "@/providers/AuthWrapper";

const queryClient = new QueryClient();

import { Session } from "next-auth";
import { ThemeProvider } from "@/components/ThemeProvider";

export function AppProviders({ children, session }: { children: ReactNode; session: Session | null }) {
  const defaultTheme = session?.user?.theme || "light";

  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <RecipeProvider>
              <ShoppingListProvider>
                <AuthWrapper>
                  {children}
                </AuthWrapper>
                <Toaster />
              </ShoppingListProvider>
            </RecipeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
