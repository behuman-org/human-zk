import { useI18n } from "../../i18n/I18nProvider";
import { ScrollReveal } from "../ui/ScrollReveal";
import "./SiteFooter.css";

export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <ScrollReveal className="site-footer__inner">
        <p className="site-footer__message">{t.footer.message}</p>

        <nav className="site-footer__nav" aria-label="Pie de página">
          {t.footer.nav.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="site-footer__bottom">
          <nav className="site-footer__external" aria-label="Enlaces externos">
            {t.footer.external.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </nav>
          <p className="site-footer__legal">
            {t.footer.legalPrefix} {year} {t.footer.legalSuffix}
          </p>
        </div>
      </ScrollReveal>
    </footer>
  );
}
