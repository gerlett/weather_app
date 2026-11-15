"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Two languages, German and English. Default: German when the system/browser
 * language is German, English otherwise. A choice made with the switch in the
 * header is remembered in this browser and wins over the system language.
 *
 * Texts are written inline as pairs – `t("Temperatur", "Temperature")` – so a
 * translation always sits next to its German original.
 */
export type Lang = "de" | "en";

const KEY = "wetter-perg:lang";

// Module-level copy for plain functions (formatters, weather codes, error texts).
// Set by the provider during render, before any child renders.
let current: Lang = "de";
export const getLang = () => current;
/** Pick the text for the active language (outside components). */
export const tr = (de: string, en: string) => (current === "de" ? de : en);
/** Locale for number/date formatting. */
export const locale = () => (current === "de" ? "de-AT" : "en-GB");

function systemLang(): Lang {
  const langs = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  return (langs[0] ?? "").toLowerCase().startsWith("de") ? "de" : "en";
}

function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "de" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "de", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  // The static build is rendered in German; the real language is applied right after load.
  const [lang, setLangState] = useState<Lang>("de");
  current = lang;

  useEffect(() => {
    setLangState(storedLang() ?? systemLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  // No remount on a switch (that would reload all data): every component that shows
  // text or formatted values calls useLang(), so it re-renders with the new language.
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  const t = useCallback((de: string, en: string) => (lang === "de" ? de : en), [lang]);
  return { lang, setLang, t };
}
