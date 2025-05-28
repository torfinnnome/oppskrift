
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { siteConfig } from "@/config/site";

export type LanguageCode = typeof siteConfig.locales[number];

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(siteConfig.defaultLocale);

  useEffect(() => {
    const storedLang = localStorage.getItem("oppskriftLang") as LanguageCode | null; // Changed key
    if (storedLang && siteConfig.locales.includes(storedLang)) {
      setLanguageState(storedLang);
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem("oppskriftLang", lang); // Changed key
  };
  
  // Prevent hydration mismatch for localStorage access
  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null; // Or a loading spinner
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

