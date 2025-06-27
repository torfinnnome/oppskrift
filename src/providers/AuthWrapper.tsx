import React, { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/i18n";

export function AuthWrapper({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return <AuthProvider t={t}>{children}</AuthProvider>;
}