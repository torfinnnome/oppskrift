import { useContext } from 'react';
import { LanguageContext, type LanguageCode } from '@/contexts/LanguageContext';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import no from '@/locales/no.json';

export const translations: Record<LanguageCode, Record<string, string>> = {
  en,
  es,
  no,
};

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  const { language } = context;

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let translation = translations[language]?.[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        translation = translation.replace(`{{${k}}}`, String(v));
      });
    }
    return translation;
  };

  return { t, currentLanguage: language, changeLanguage: context.setLanguage };
}
