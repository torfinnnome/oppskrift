export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Oppskrift",
  description: "Your personal recipe book, simplified.",
  locales: ["en", "no", "es"],
  defaultLocale: "no",
  localeNames: {
    en: "English",
    no: "Norsk",
    es: "Español",
  },
};
