import { useI18n } from "../../i18n/I18nProvider";
import { BentoSection, MagicBentoCard } from "../backgrounds/MagicBento/MagicBento";
import { ScrollReveal } from "../ui/ScrollReveal";
import "./LayersSection.css";

export function LayersSection() {
  const { t } = useI18n();
  const layers = t.layers;

  return (
    <section id="capas" className="page-section layers">
      <div className="page-section__inner">
        <ScrollReveal className="section-intro">
          <span className="section-label">{layers.label}</span>
          <h2 className="section-title">{layers.title}</h2>
          <p className="section-lead">{layers.lead}</p>
        </ScrollReveal>
        <BentoSection className="layers__grid">
          {layers.items.map((layer, index) => (
            <ScrollReveal key={layer.id} delay={index * 100}>
              <MagicBentoCard as="article" className="layer-card" id={layer.id}>
                <span className="layer-card__tag">{layer.tag}</span>
                <h3 className="layer-card__title">{layer.title}</h3>
                <p className="layer-card__body">{layer.body}</p>
                <ul className="layer-card__list">
                  {layer.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </MagicBentoCard>
            </ScrollReveal>
          ))}
        </BentoSection>
        <ScrollReveal className="layers__bridge" delay={200}>
          {layers.bridge}
        </ScrollReveal>
      </div>
    </section>
  );
}
