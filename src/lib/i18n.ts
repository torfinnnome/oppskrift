
import { useContext, useCallback } from 'react'; // Added useCallback
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
  const { language, setLanguage } = context; // Destructure setLanguage for the return

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let translation = translations[language]?.[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        translation = translation.replace(`{{${k}}}`, String(v));
      });
    }
    return translation;
  }, [language]); // t is now memoized and only changes if 'language' changes

  return { t, currentLanguage: language, changeLanguage: setLanguage }; // Return setLanguage as changeLanguage
}
