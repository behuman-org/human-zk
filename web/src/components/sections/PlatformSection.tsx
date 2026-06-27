import { useI18n } from "../../i18n/I18nProvider";
import { BentoSection, MagicBentoCard } from "../backgrounds/MagicBento/MagicBento";
import { ScrollReveal } from "../ui/ScrollReveal";
import "./PlatformSection.css";

export function PlatformSection() {
  const { t } = useI18n();
  const platform = t.platform;

  return (
    <section id="plataforma" className="page-section platform">
      <div className="page-section__inner">
        <ScrollReveal className="section-intro">
          <span className="section-label">{platform.label}</span>
          <h2 className="section-title">{platform.title}</h2>
          <p className="section-lead">{platform.lead}</p>
        </ScrollReveal>
        <ScrollReveal
          className="platform__kinds"
          delay={80}
          aria-label={platform.postKindsAria}
        >
          {platform.postKinds.map((kind) => (
            <span key={kind} className="platform__kind">
              {kind}
            </span>
          ))}
        </ScrollReveal>
        <BentoSection className="platform__grid">
          {platform.features.map((feature, index) => (
            <ScrollReveal key={feature.title} delay={index * 100}>
              <MagicBentoCard as="article" className="platform-card">
                <h3 className="platform-card__title">{feature.title}</h3>
                <p className="platform-card__body">{feature.body}</p>
              </MagicBentoCard>
            </ScrollReveal>
          ))}
        </BentoSection>
      </div>
    </section>
  );
}
