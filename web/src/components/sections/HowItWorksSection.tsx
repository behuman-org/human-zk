import { useI18n } from "../../i18n/I18nProvider";
import { BentoSection, MagicBentoCard } from "../backgrounds/MagicBento/MagicBento";
import { ScrollReveal } from "../ui/ScrollReveal";
import "./HowItWorksSection.css";

export function HowItWorksSection() {
  const { t } = useI18n();
  const kycFlow = t.kycFlow;

  return (
    <section id="como-funciona" className="page-section how-it-works">
      <div className="page-section__inner">
        <ScrollReveal className="section-intro">
          <span className="section-label">{kycFlow.label}</span>
          <h2 className="section-title">{kycFlow.title}</h2>
          <p className="section-lead">{kycFlow.lead}</p>
        </ScrollReveal>
        <BentoSection className="how-it-works__steps" as="ol">
          {kycFlow.steps.map((step, index) => (
            <ScrollReveal key={step.num} delay={index * 90}>
              <MagicBentoCard as="li" className="step-card">
                <span className="step-card__num">{step.num}</span>
                <h3 className="step-card__title">{step.title}</h3>
                <p className="step-card__body">{step.body}</p>
              </MagicBentoCard>
            </ScrollReveal>
          ))}
        </BentoSection>
      </div>
    </section>
  );
}
