import { HeroSection } from "../components/hero/HeroSection";
import { DotRegion } from "../components/layout/DotRegion";
import { PageBackdrop } from "../components/layout/PageBackdrop";
import { SectionDivider } from "../components/layout/SectionDivider";
import { SiteFooter } from "../components/layout/SiteFooter";
import { SiteNav } from "../components/layout/SiteNav";
import { TechMarquee } from "../components/layout/TechMarquee";
import { CurationSection } from "../components/sections/CurationSection";
import { HowItWorksSection } from "../components/sections/HowItWorksSection";
import { LayersSection } from "../components/sections/LayersSection";
import { PlatformSection } from "../components/sections/PlatformSection";
import { useI18n } from "../i18n/I18nProvider";
import "../App.css";
import "./LandingPage.css";

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="landing">
      <PageBackdrop />
      <SiteNav />
      <main className="landing__main">
        <HeroSection />
        <TechMarquee />
        <DotRegion>
          <SectionDivider phrase={t.sectionDividers[0]} />
          <LayersSection />
          <SectionDivider phrase={t.sectionDividers[1]} />
          <HowItWorksSection />
          <SectionDivider phrase={t.sectionDividers[2]} />
          <PlatformSection />
          <SectionDivider phrase={t.sectionDividers[3]} />
          <CurationSection />
        </DotRegion>
      </main>
      <SiteFooter />
    </div>
  );
}
