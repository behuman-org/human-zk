import { useEffect, useRef } from "react";

export interface NormalizedPoint {
  x: number;
  y: number;
}

interface Options {
  enabled?: boolean;
  /** 0–1 — qué tan rápido persigue el target */
  strength?: number;
}

const DEFAULT: NormalizedPoint = { x: 0.5, y: 0.42 };

/**
 * Posición normalizada (0–1) que sigue al pointer con inercia tipo spring.
 * Expone ref mutable para loops canvas sin re-render por frame.
 */
export function usePointerSpring(options: Options = {}) {
  const { enabled = true, strength = 0.08 } = options;
  const positionRef = useRef<NormalizedPoint>({ ...DEFAULT });
  const targetRef = useRef<NormalizedPoint>({ ...DEFAULT });

  useEffect(() => {
    if (!enabled) {
      positionRef.current = { ...DEFAULT };
      targetRef.current = { ...DEFAULT };
      return;
    }

    const onMove = (event: PointerEvent) => {
      targetRef.current = {
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
      };
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    let frame = 0;
    const tick = () => {
      const t = targetRef.current;
      const c = positionRef.current;
      c.x += (t.x - c.x) * strength;
      c.y += (t.y - c.y) * strength;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [enabled, strength]);

  return positionRef;
}
