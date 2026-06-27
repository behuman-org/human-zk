import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  threshold: 0.12,
  rootMargin: "0px 0px -8% 0px",
};

/** Detecta cuando un nodo entra al viewport (una sola vez). */
export function useInView() {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setInView(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, DEFAULT_OPTIONS);

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return { ref, inView };
}
