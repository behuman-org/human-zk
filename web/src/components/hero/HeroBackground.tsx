import { FaultyTerminal } from "../backgrounds/FaultyTerminal/FaultyTerminal";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import "./HeroBackground.css";

/**
 * Fondo del hero: terminal glitch (React Bits / ogl) sobre tema claro.
 */
export function HeroBackground() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="hero-bg" aria-hidden="true">
      <div className="hero-bg__glow" />
      <FaultyTerminal
        className="hero-bg__terminal"
        scale={1.5}
        gridMul={[2, 1]}
        digitSize={1.35}
        timeScale={1.15}
        pause={reducedMotion}
        scanlineIntensity={1}
        glitchAmount={1.15}
        flickerAmount={1}
        noiseAmp={1.2}
        chromaticAberration={0}
        dither={0}
        curvature={0}
        tint="#2a7594"
        backgroundColor="#f4f4f4"
        mouseReact={!reducedMotion}
        mouseStrength={0.65}
        pageLoadAnimation={!reducedMotion}
        brightness={0.92}
      />
      <div className="hero-bg__wash" />
      <div className="hero-bg__vignette" />
    </div>
  );
}
