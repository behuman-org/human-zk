import { ScrollReveal } from "../ui/ScrollReveal";
import "./SectionDivider.css";

interface SectionDividerProps {
  phrase: string;
}

export function SectionDivider({ phrase }: SectionDividerProps) {
  return (
    <ScrollReveal className="section-divider" delay={0}>
      <span className="section-divider__line" aria-hidden="true" />
      <p className="section-divider__phrase">{phrase}</p>
      <span className="section-divider__line" aria-hidden="true" />
    </ScrollReveal>
  );
}
