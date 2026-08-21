"use client";

import { usePathname } from "next/navigation";
import { type AppLanguage, useLanguage } from "./i18n";

const languages: Array<{ id: AppLanguage; label: string }> = [
  { id: "ko", label: "한국어" },
  { id: "en", label: "English" },
  { id: "fa", label: "فارسی" },
  { id: "ja", label: "日本語" },
];

export default function LoginLanguageSwitcher() {
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();

  if (pathname !== "/login") return null;

  return (
    <div className="language-switcher" aria-label="Language">
      {languages.map((item) => (
        <button
          aria-pressed={language === item.id}
          className={language === item.id ? "active" : ""}
          key={item.id}
          lang={item.id}
          onClick={() => setLanguage(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
