import { useI18n } from "../../i18n/I18nProvider";
import { BentoSection, MagicBentoCard } from "../backgrounds/MagicBento/MagicBento";
import { ScrollReveal } from "../ui/ScrollReveal";
import "./CurationSection.css";

export function CurationSection() {
  const { t } = useI18n();
  const curation = t.curation;

  return (
    <section id="curacion" className="page-section curation">
      <div className="page-section__inner">
        <ScrollReveal className="section-intro">
          <span className="section-label">{curation.label}</span>
          <h2 className="section-title">{curation.title}</h2>
          <p className="section-lead">{curation.lead}</p>
        </ScrollReveal>
        <BentoSection className="curation__grid">
          {curation.levels.map((level, index) => (
            <ScrollReveal key={level.title} delay={index * 100}>
              <MagicBentoCard as="article" className="curation-card">
                <span className="curation-card__level">
                  {curation.levelPrefix} {index + 1}
                </span>
                <h3 className="curation-card__title">{level.title}</h3>
                <p className="curation-card__body">{level.body}</p>
              </MagicBentoCard>
            </ScrollReveal>
          ))}
        </BentoSection>
        <ScrollReveal delay={180}>
          <MagicBentoCard as="blockquote" className="curation__quote">
            <p>{curation.principle}</p>
          </MagicBentoCard>
        </ScrollReveal>
      </div>
    </section>
  );
}
