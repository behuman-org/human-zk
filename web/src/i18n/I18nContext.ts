import { createContext } from "react";
import { en } from "./locales/en";
import { es } from "./locales/es";
import type { Locale, SiteMessages } from "./types";

export const STORAGE_KEY = "human-locale";

export const messages: Record<Locale, SiteMessages> = { en, es };

export function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "es") return stored;
  } catch {
    /* private mode / SSR */
  }
  return "en";
}

export type I18nContextValue = {
  locale: Locale;
  t: SiteMessages;
  setLocale: (locale: Locale) => void;
};

export const I18nContext = createContext<I18nContextValue | null>(null);
