import { useI18n } from "../../i18n/I18nProvider";
import "./LanguageToggle.css";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`language-toggle ${className}`.trim()}
      role="group"
      aria-label={t.ui.language}
    >
      <button
        type="button"
        className={`language-toggle__btn ${locale === "en" ? "is-active" : ""}`}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={`language-toggle__btn ${locale === "es" ? "is-active" : ""}`}
        aria-pressed={locale === "es"}
        onClick={() => setLocale("es")}
      >
        ES
      </button>
    </div>
  );
}
