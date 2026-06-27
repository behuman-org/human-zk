import { useState } from "react";
import { Link } from "react-router-dom";
import SideRays from "../components/backgrounds/SideRays/SideRays";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { useI18n } from "../i18n/I18nProvider";
import { useReducedMotion } from "../hooks/useReducedMotion";
import "./AuthPage.css";

type AuthTab = "login" | "register";

export function AuthPage({ defaultTab = "login" }: { defaultTab?: AuthTab }) {
  const { t } = useI18n();
  const auth = t.auth;
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const reducedMotion = useReducedMotion();

  return (
    <div className="auth-page">
      <section className="auth-page__form-panel" aria-labelledby="auth-heading">
        <div className="auth-page__form-inner">
          <div className="auth-page__top-row">
            <Link to="/" className="auth-page__back">
              {auth.backToHome}
            </Link>
            <LanguageToggle />
          </div>

          <header className="auth-page__header">
            <p className="auth-page__eyebrow">{auth.eyebrow}</p>
            <h1 id="auth-heading">{tab === "login" ? auth.loginTitle : auth.registerTitle}</h1>
            <p className="auth-page__subtitle">
              {tab === "login" ? auth.loginSubtitle : auth.registerSubtitle}
            </p>
          </header>

          <div className="auth-page__tabs" role="tablist" aria-label={auth.tabListLabel}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "login"}
              className={`auth-page__tab ${tab === "login" ? "is-active" : ""}`}
              onClick={() => setTab("login")}
            >
              {auth.tabLogin}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "register"}
              className={`auth-page__tab ${tab === "register" ? "is-active" : ""}`}
              onClick={() => setTab("register")}
            >
              {auth.tabRegister}
            </button>
          </div>

          {tab === "login" ? (
            <div className="auth-page__panel">
              <div className="auth-page__status is-muted">
                <p className="auth-page__status-title">{auth.loginPanelTitle}</p>
                <p className="auth-page__status-body">{auth.loginPanelBody}</p>
              </div>

              <button type="button" className="auth-page__submit" disabled>
                {auth.connectWallet}
              </button>

              <p className="auth-page__hint auth-page__hint--warn">{auth.comingSoon}</p>
            </div>
          ) : (
            <div className="auth-page__panel">
              <p className="auth-page__no-password">{auth.noPassword}</p>

              <ol className="auth-page__steps">
                {auth.registerSteps.map((step, i) => (
                  <li key={step.title}>
                    <span className="auth-page__step-num">{i + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <button type="button" className="auth-page__submit" disabled>
                {auth.startVerification}
              </button>

              <p className="auth-page__hint auth-page__hint--warn">{auth.comingSoon}</p>
            </div>
          )}

          <p className="auth-page__legal">{auth.legal}</p>
        </div>
      </section>

      <section className="auth-page__brand-panel" aria-label={auth.brandPanelLabel}>
        <div className="auth-page__rays" aria-hidden="true">
          {!reducedMotion && (
            <SideRays
              origin="top-right"
              rayColor1="#38bdf8"
              rayColor2="#d4d4d4"
              intensity={2.8}
              spread={2.4}
              speed={2.2}
              saturation={1.55}
              blend={0.62}
              falloff={1.45}
              opacity={1}
              tilt={-6}
            />
          )}
        </div>

        <div className="auth-page__brand-content">
          <h2 className="auth-page__brand-title">
            {auth.brandTitle}
            <span>{auth.brandTitleAccent}</span>
          </h2>
          <p className="auth-page__brand-slogan">{t.siteMeta.tagline}</p>
        </div>
      </section>
    </div>
  );
}
