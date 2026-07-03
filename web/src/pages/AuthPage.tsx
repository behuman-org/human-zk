import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeroBackground } from "../components/hero/HeroBackground";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { useI18n } from "../i18n/useI18n";
import { connectAndCheck, hasCredential } from "../identity/identity";
import { clearLoggedOut } from "../feed/session";
import { POLLAR_ENABLED, PollarEmailLogin } from "../identity/pollar";
import "./AuthPage.css";

type AuthTab = "login" | "register";

export function AuthPage({ defaultTab = "login" }: { defaultTab?: AuthTab }) {
  const { t } = useI18n();
  const auth = t.auth;
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login: conecta la wallet. La identidad de plataforma vive en una credencial del device
  // (no en la wallet, por anonimato). Si ya hay credencial en este navegador → entra al feed
  // con su usuario. Si no → no hay "usuario" todavía: lo mandamos al onboarding (KYC) a crearla
  // en vez de dejarlo entrar como invitado fantasma.
  async function handleLogin() {
    setError(null);
    setBusy(true);
    try {
      await connectAndCheck();
      clearLoggedOut();
      navigate(hasCredential() ? "/app" : "/onboarding");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
              {/* Dos rutas claras para no confundir: ya tengo wallet · o creo una con email. */}
              <button
                type="button"
                className="auth-page__submit"
                onClick={handleLogin}
                disabled={busy}
              >
                {busy ? "…" : auth.connectWallet}
              </button>
              <p className="auth-page__hint">If you already have a wallet (Freighter, xBull, LOBSTR…).</p>

              <div className="auth-page__pollar">
                <span className="auth-page__or">o</span>
                {POLLAR_ENABLED ? (
                  <PollarEmailLogin onReady={() => navigate("/onboarding?via=email")} />
                ) : (
                  <button
                    type="button"
                    className="auth-page__submit auth-page__submit--alt"
                    disabled
                    title="Set VITE_POLLAR_PUBLISHABLE_KEY in .env to enable Pollar"
                  >
                    Create account with email
                  </button>
                )}
                <p className="auth-page__hint">
                  No wallet yet? We create one with your email. <strong>It is never linked</strong> to
                  your anonymous identity.
                </p>
              </div>

              {error && <p className="auth-page__hint auth-page__hint--warn">{error}</p>}
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

              <button
                type="button"
                className="auth-page__submit"
                onClick={() => navigate("/onboarding")}
              >
                {auth.startVerification}
              </button>

              {/* Ruta fácil para quien no tiene wallet: crearla con email vía Pollar.
                  Pollar solo crea la wallet; tu identidad anónima nunca se vincula al email. */}
              {POLLAR_ENABLED && (
                <div className="auth-page__pollar">
                  <span className="auth-page__or">o</span>
                  <PollarEmailLogin onReady={() => navigate("/onboarding?via=email")} />
                  <p className="auth-page__hint">
                    Your email creates your wallet, but <strong>is never linked</strong> to your anonymous identity.
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="auth-page__legal">{auth.legal}</p>
        </div>
      </section>

      <section className="auth-page__brand-panel" aria-label={auth.brandPanelLabel}>
        <div className="auth-page__rays" aria-hidden="true">
          <HeroBackground />
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
