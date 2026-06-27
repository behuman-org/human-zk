import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ScrollReveal } from "../ui/ScrollReveal";
import { HeroBackground } from "./HeroBackground";
import "./HeroSection.css";

export function HeroSection() {
  const { t } = useI18n();
  const hero = t.hero;
  const marqueeItems = [...hero.stackItems, ...hero.stackItems];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <HeroBackground />
      <div className="hero__content">
        <ScrollReveal delay={0}>
          <Badge>{hero.badge}</Badge>
        </ScrollReveal>
        <ScrollReveal delay={80}>
          <h1 id="hero-title" className="hero__title">
            {hero.title}
            <span className="hero__accent">{hero.accent}</span>
          </h1>
        </ScrollReveal>
        <ScrollReveal delay={160}>
          <p className="hero__lead">{hero.lead}</p>
        </ScrollReveal>
        <ScrollReveal className="hero__actions" delay={240}>
          <Link to="/register" className="btn btn--primary">
            {hero.ctaVerify}
          </Link>
          <Button
            variant="ghost"
            onClick={() =>
              document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            {hero.ctaHowItWorks}
          </Button>
        </ScrollReveal>
        <ScrollReveal delay={320}>
          <p className="hero__chains">{hero.stackLabel}</p>
          <div className="hero__marquee" aria-hidden="true">
            <div className="hero__marquee-track">
              {marqueeItems.map((item, index) => (
                <span key={`${item}-${index}`}>{item}</span>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
