"use client";

import React, { type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RecipeProvider } from "@/contexts/RecipeContext";
import { ShoppingListProvider } from "@/contexts/ShoppingListContext";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <RecipeProvider>
            <ShoppingListProvider>
              {children}
              <Toaster />
            </ShoppingListProvider>
          </RecipeProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
