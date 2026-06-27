import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { brand } from "../../content/brand";
import { useI18n } from "../../i18n/I18nProvider";
import { LanguageToggle } from "../ui/LanguageToggle";
import "./SiteNav.css";

function NavAnchor({ href, className, children, onClick }: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

export function SiteNav() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-nav-shell">
      <header className="site-nav">
        <div className="site-nav__glass" aria-hidden="true">
          <span className="site-nav__shine" />
        </div>

        <a href="#" className="site-nav__brand" onClick={closeMenu}>
          <img
            src={brand.logoHorizontal}
            alt={brand.wordmark}
            className="site-nav__logo"
          />
        </a>

        <nav className="site-nav__links" aria-label="Principal">
          {t.navLinks.map((link) => (
            <NavAnchor key={link.href} href={link.href} className="site-nav__link">
              {link.label}
            </NavAnchor>
          ))}
        </nav>

        <div className="site-nav__actions">
          <LanguageToggle className="site-nav__lang" />
          <Link to="/login" className="site-nav__auth" onClick={closeMenu}>
            {t.ui.signIn}
          </Link>
          <Link
            to="/register"
            className="site-nav__auth site-nav__auth--register"
            onClick={closeMenu}
          >
            {t.ui.register}
          </Link>
          <button
            type="button"
            className="site-nav__menu-btn"
            aria-expanded={menuOpen}
            aria-controls="site-nav-mobile"
            aria-label={menuOpen ? t.ui.closeMenu : t.ui.openMenu}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={`site-nav__menu-icon ${menuOpen ? "is-open" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav
        id="site-nav-mobile"
        className={`site-nav__mobile ${menuOpen ? "is-open" : ""}`}
        aria-label="Principal móvil"
        aria-hidden={!menuOpen}
      >
        <div className="site-nav__mobile-glass" aria-hidden="true">
          <span className="site-nav__shine" />
        </div>
        {t.navLinks.map((link) => (
          <NavAnchor
            key={link.href}
            href={link.href}
            onClick={closeMenu}
            className="site-nav__mobile-link"
          >
            {link.label}
          </NavAnchor>
        ))}
        <div className="site-nav__mobile-lang">
          <LanguageToggle />
        </div>
        <div className="site-nav__mobile-auth">
          <Link to="/login" className="site-nav__mobile-auth-link" onClick={closeMenu}>
            {t.ui.signIn}
          </Link>
          <Link
            to="/register"
            className="site-nav__mobile-auth-link site-nav__mobile-auth-link--register"
            onClick={closeMenu}
          >
            {t.ui.register}
          </Link>
        </div>
      </nav>
    </div>
  );
}
