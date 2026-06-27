import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useAppPreferences, type ThemeMode } from "../preferences/AppPreferencesProvider";
import "./SettingsPage.css";
import "./SocialShell.css";

function SettingToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-toggle" htmlFor={id}>
      <span className="settings-toggle__copy">
        <span className="settings-toggle__label">{label}</span>
        <span className="settings-toggle__desc">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        className="settings-toggle__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="settings-toggle__track" aria-hidden="true" />
    </label>
  );
}

export function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const s = t.social.settings;
  const prefs = useAppPreferences();
  const [resetFlash, setResetFlash] = useState(false);

  const themes: { id: ThemeMode; label: string }[] = [
    { id: "light", label: s.themeLight },
    { id: "dark", label: s.themeDark },
    { id: "system", label: s.themeSystem },
  ];

  function resetAll() {
    prefs.resetPreferences();
    setResetFlash(true);
    window.setTimeout(() => setResetFlash(false), 2200);
  }

  return (
    <div className="settings-page">
      <header className="feed-column__top">
        <h1 className="feed-column__title">{s.title}</h1>
        <p className="feed-column__subtitle">{s.subtitle}</p>
      </header>

      <section className="settings-page__section">
        <h2 className="settings-page__heading">{s.appearance}</h2>

        <div className="settings-page__group">
          <p className="settings-page__label">{s.theme}</p>
          <div className="settings-page__segment" role="group" aria-label={s.theme}>
            {themes.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`settings-page__segment-btn ${prefs.theme === id ? "is-active" : ""}`}
                aria-pressed={prefs.theme === id}
                onClick={() => prefs.setTheme(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <SettingToggle
          id="compact-feed"
          label={s.compactFeed}
          description={s.compactFeedDesc}
          checked={prefs.compactFeed}
          onChange={prefs.setCompactFeed}
        />
        <SettingToggle
          id="reduced-motion"
          label={s.reducedMotion}
          description={s.reducedMotionDesc}
          checked={prefs.reducedMotion}
          onChange={prefs.setReducedMotion}
        />
        <SettingToggle
          id="show-sidebar"
          label={s.showSidebar}
          description={s.showSidebarDesc}
          checked={prefs.showRightRail}
          onChange={prefs.setShowRightRail}
        />
      </section>

      <section className="settings-page__section">
        <h2 className="settings-page__heading">{s.language}</h2>
        <p className="settings-page__hint">{s.languageDesc}</p>
        <div className="settings-page__segment" role="group" aria-label={s.language}>
          <button
            type="button"
            className={`settings-page__segment-btn ${locale === "es" ? "is-active" : ""}`}
            aria-pressed={locale === "es"}
            onClick={() => setLocale("es")}
          >
            Español
          </button>
          <button
            type="button"
            className={`settings-page__segment-btn ${locale === "en" ? "is-active" : ""}`}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            English
          </button>
        </div>
      </section>

      <section className="settings-page__section">
        <h2 className="settings-page__heading">{s.privacy}</h2>
        <div className="settings-page__static">
          <p className="settings-page__static-title">{s.privacyProfile}</p>
          <p className="settings-page__static-desc">{s.privacyProfileDesc}</p>
        </div>
        <div className="settings-page__static">
          <p className="settings-page__static-title">{s.privacyMessages}</p>
          <p className="settings-page__static-desc">{s.privacyMessagesDesc}</p>
        </div>
      </section>

      <section className="settings-page__section">
        <h2 className="settings-page__heading">{s.account}</h2>
        <p className="settings-page__hint">{s.editProfileHint}</p>
        <Link to="/app/profile" className="settings-page__link-btn">
          {s.goToProfile}
        </Link>
        <button type="button" className="settings-page__reset" onClick={resetAll}>
          {resetFlash ? s.resetDone : s.reset}
        </button>
      </section>
    </div>
  );
}
