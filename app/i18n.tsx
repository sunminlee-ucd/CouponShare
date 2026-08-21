"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LanguageProvider as CoreLanguageProvider,
  useLanguage as useCoreLanguage,
} from "./i18n-core";
import { japaneseMessages } from "./i18n-ja";

export type AppLanguage = "ko" | "en" | "fa" | "ja";

const STORAGE_KEY = "couponshare-language-v1";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (source: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "ko",
  setLanguage: () => undefined,
  t: (source) => source,
});

function LanguageBridge({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const core = useCoreLanguage();
  const [japanese, setJapanese] = useState(false);
  const isAdmin = pathname.startsWith("/admin");
  const language: AppLanguage = japanese ? "ja" : core.language;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ja") queueMicrotask(() => setJapanese(true));
  }, []);

  useEffect(() => {
    const activeLanguage = isAdmin ? "ko" : language;
    queueMicrotask(() => {
      document.documentElement.lang = activeLanguage;
      document.documentElement.dir = activeLanguage === "fa" ? "rtl" : "ltr";
    });
  }, [isAdmin, language]);

  function setLanguage(nextLanguage: AppLanguage) {
    if (nextLanguage === "ja") {
      setJapanese(true);
      localStorage.setItem(STORAGE_KEY, "ja");
      return;
    }

    setJapanese(false);
    core.setLanguage(nextLanguage);
  }

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (source) => language === "ja" ? japaneseMessages[source] ?? source : core.t(source),
  }), [language, core]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  return (
    <CoreLanguageProvider>
      <LanguageBridge>{children}</LanguageBridge>
    </CoreLanguageProvider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LocalizedText({ text }: { text: string }) {
  const { t } = useLanguage();
  return <>{t(text)}</>;
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  if (pathname.startsWith("/admin")) return null;

  const languages: Array<{ id: AppLanguage; label: string }> = [
    { id: "ko", label: "한국어" },
    { id: "en", label: "English" },
    { id: "fa", label: "فارسی" },
    { id: "ja", label: "日本語" },
  ];

  return (
    <div className="language-switcher" aria-label="Language">
      {languages.map((item) => (
        <button
          className={language === item.id ? "active" : ""}
          key={item.id}
          lang={item.id}
          type="button"
          onClick={() => setLanguage(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
