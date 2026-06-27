import { gsap } from "gsap";
import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useReducedMotion } from "../../../hooks/useReducedMotion";
import "./MagicBento.css";

const DEFAULT_PARTICLE_COUNT = 8;
const DEFAULT_SPOTLIGHT_RADIUS = 280;
const DEFAULT_GLOW_RGB = "14, 165, 233";
const MOBILE_BREAKPOINT = 768;

type MagicElement = "div" | "article" | "li" | "blockquote";

interface MagicBentoCardProps {
  children: ReactNode;
  className?: string;
  as?: MagicElement;
  id?: string;
  style?: CSSProperties;
  glowColor?: string;
  enableParticles?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
}

function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function createParticleElement(x: number, y: number, glowRgb: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "magic-bento__particle";
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${glowRgb}, 0.9);
    box-shadow: 0 0 6px rgba(${glowRgb}, 0.45);
    pointer-events: none;
    z-index: 2;
    left: ${x}px;
    top: ${y}px;
  `;
  return el;
}

function updateCardGlow(
  card: HTMLElement,
  mouseX: number,
  mouseY: number,
  glow: number,
  radius: number,
) {
  const rect = card.getBoundingClientRect();
  const relativeX = ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = ((mouseY - rect.top) / rect.height) * 100;
  card.style.setProperty("--glow-x", `${relativeX}%`);
  card.style.setProperty("--glow-y", `${relativeY}%`);
  card.style.setProperty("--glow-intensity", glow.toString());
  card.style.setProperty("--glow-radius", `${radius}px`);
}

function GlobalSpotlight({
  gridRef,
  disabled,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowRgb = DEFAULT_GLOW_RGB,
}: {
  gridRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  spotlightRadius?: number;
  glowRgb?: string;
}) {
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled || !gridRef.current) return;

    const spotlight = document.createElement("div");
    spotlight.className = "magic-bento__spotlight";
    spotlight.style.background = `radial-gradient(circle,
      rgba(${glowRgb}, 0.12) 0%,
      rgba(${glowRgb}, 0.06) 18%,
      rgba(${glowRgb}, 0.02) 35%,
      transparent 70%
    )`;
    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const proximity = spotlightRadius * 0.5;
    const fadeDistance = spotlightRadius * 0.75;

    const onMove = (e: MouseEvent) => {
      if (!spotlightRef.current || !gridRef.current) return;

      const section = gridRef.current.closest(".magic-bento-section");
      const rect = section?.getBoundingClientRect();
      const inside =
        rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      const cards = gridRef.current.querySelectorAll(".magic-bento-card");

      if (!inside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
        cards.forEach((card) => (card as HTMLElement).style.setProperty("--glow-intensity", "0"));
        return;
      }

      let minDistance = Infinity;

      cards.forEach((card) => {
        const el = card as HTMLElement;
        const cardRect = el.getBoundingClientRect();
        const cx = cardRect.left + cardRect.width / 2;
        const cy = cardRect.top + cardRect.height / 2;
        const distance =
          Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(cardRect.width, cardRect.height) / 2;
        const effective = Math.max(0, distance);
        minDistance = Math.min(minDistance, effective);

        let intensity = 0;
        if (effective <= proximity) intensity = 1;
        else if (effective <= fadeDistance) {
          intensity = (fadeDistance - effective) / (fadeDistance - proximity);
        }
        updateCardGlow(el, e.clientX, e.clientY, intensity, spotlightRadius);
      });

      gsap.to(spotlightRef.current, {
        left: e.clientX,
        top: e.clientY,
        duration: 0.1,
        ease: "power2.out",
      });

      const opacity =
        minDistance <= proximity
          ? 0.55
          : minDistance <= fadeDistance
            ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) * 0.55
            : 0;

      gsap.to(spotlightRef.current, {
        opacity,
        duration: opacity > 0 ? 0.2 : 0.4,
        ease: "power2.out",
      });
    };

    const onLeave = () => {
      gridRef.current?.querySelectorAll(".magic-bento-card").forEach((card) => {
        (card as HTMLElement).style.setProperty("--glow-intensity", "0");
      });
      if (spotlightRef.current) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      spotlightRef.current?.parentNode?.removeChild(spotlightRef.current);
    };
  }, [disabled, gridRef, glowRgb, spotlightRadius]);

  return null;
}

export function MagicBentoCard({
  children,
  className = "",
  as = "div",
  id,
  style,
  glowColor = DEFAULT_GLOW_RGB,
  enableParticles = true,
  enableTilt = false,
  enableMagnetism = false,
  clickEffect = false,
}: MagicBentoCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isHoveredRef = useRef(false);
  const memoizedParticles = useRef<HTMLDivElement[]>([]);
  const particlesReady = useRef(false);
  const magnetismRef = useRef<gsap.core.Tween | null>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useMobileDetection();
  const disabled = reducedMotion || isMobile;

  const clearParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    magnetismRef.current?.kill();
    particlesRef.current.forEach((particle) => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.25,
        ease: "back.in(1.7)",
        onComplete: () => particle.parentNode?.removeChild(particle),
      });
    });
    particlesRef.current = [];
  }, []);

  const initParticles = useCallback(() => {
    if (particlesReady.current || !cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    memoizedParticles.current = Array.from({ length: DEFAULT_PARTICLE_COUNT }, () =>
      createParticleElement(Math.random() * width, Math.random() * height, glowColor),
    );
    particlesReady.current = true;
  }, [glowColor]);

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current || disabled || !enableParticles) return;
    initParticles();
    memoizedParticles.current.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!isHoveredRef.current || !cardRef.current) return;
        const clone = particle.cloneNode(true) as HTMLDivElement;
        cardRef.current.appendChild(clone);
        particlesRef.current.push(clone);
        gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 });
        gsap.to(clone, {
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 60,
          rotation: Math.random() * 360,
          duration: 2 + Math.random() * 2,
          repeat: -1,
          yoyo: true,
          ease: "none",
        });
      }, index * 90);
      timeoutsRef.current.push(timeoutId);
    });
  }, [disabled, enableParticles, initParticles]);

  useEffect(() => {
    const element = cardRef.current;
    if (!element || disabled) return;

    const onEnter = () => {
      isHoveredRef.current = true;
      animateParticles();
    };
    const onLeave = () => {
      isHoveredRef.current = false;
      clearParticles();
      if (enableTilt) gsap.to(element, { rotateX: 0, rotateY: 0, duration: 0.3 });
      if (enableMagnetism) gsap.to(element, { x: 0, y: 0, duration: 0.3 });
    };
    const onMove = (e: MouseEvent) => {
      if (!enableTilt && !enableMagnetism) return;
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      if (enableTilt) {
        gsap.to(element, {
          rotateX: ((y - cy) / cy) * -6,
          rotateY: ((x - cx) / cx) * 6,
          duration: 0.12,
          transformPerspective: 800,
        });
      }
      if (enableMagnetism) {
        magnetismRef.current = gsap.to(element, {
          x: (x - cx) * 0.04,
          y: (y - cy) * 0.04,
          duration: 0.25,
        });
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!clickEffect) return;
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height),
      );
      const ripple = document.createElement("div");
      ripple.className = "magic-bento__ripple";
      ripple.style.width = `${maxDistance * 2}px`;
      ripple.style.height = `${maxDistance * 2}px`;
      ripple.style.left = `${x - maxDistance}px`;
      ripple.style.top = `${y - maxDistance}px`;
      ripple.style.background = `radial-gradient(circle, rgba(${glowColor}, 0.25) 0%, transparent 70%)`;
      element.appendChild(ripple);
      gsap.fromTo(ripple, { scale: 0, opacity: 1 }, {
        scale: 1,
        opacity: 0,
        duration: 0.7,
        onComplete: () => ripple.remove(),
      });
    };

    element.addEventListener("mouseenter", onEnter);
    element.addEventListener("mouseleave", onLeave);
    element.addEventListener("mousemove", onMove);
    element.addEventListener("click", onClick);

    return () => {
      isHoveredRef.current = false;
      element.removeEventListener("mouseenter", onEnter);
      element.removeEventListener("mouseleave", onLeave);
      element.removeEventListener("mousemove", onMove);
      element.removeEventListener("click", onClick);
      clearParticles();
    };
  }, [
    animateParticles,
    clearParticles,
    clickEffect,
    disabled,
    enableMagnetism,
    enableTilt,
    glowColor,
  ]);

  return createElement(
    as,
    {
      ref: cardRef,
      id,
      className: `magic-bento-card magic-bento-card--border-glow ${className}`.trim(),
      style: {
        ...style,
        "--glow-rgb": glowColor,
      } as CSSProperties,
    },
    children,
  );
}

export function BentoSection({
  children,
  className = "",
  glowRgb = DEFAULT_GLOW_RGB,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  glowRgb?: string;
  as?: "div" | "ol" | "ul";
}) {
  const gridRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const isMobile = useMobileDetection();
  const disabled = reducedMotion || isMobile;

  return (
    <div className="magic-bento-section">
      {!disabled && (
        <GlobalSpotlight gridRef={gridRef} disabled={disabled} glowRgb={glowRgb} />
      )}
      {createElement(as, { ref: gridRef, className }, children)}
    </div>
  );
}
