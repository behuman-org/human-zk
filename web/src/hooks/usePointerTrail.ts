import { useCallback, useEffect, useRef } from "react";

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

interface Options {
  enabled?: boolean;
  maxPoints?: number;
}

/**
 * Trail ligero al mover el pointer — equivalente simplificado a mouseDraw de zk.me.
 */
export function usePointerTrail(options: Options = {}) {
  const { enabled = true, maxPoints = 24 } = options;
  const points = useRef<TrailPoint[]>([]);

  useEffect(() => {
    if (!enabled) {
      points.current = [];
      return;
    }

    const onMove = (event: PointerEvent) => {
      points.current.unshift({
        x: event.clientX,
        y: event.clientY,
        life: 1,
      });
      if (points.current.length > maxPoints) {
        points.current.length = maxPoints;
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, maxPoints]);

  const decay = useCallback(() => {
    points.current = points.current
      .map((p) => ({ ...p, life: p.life - 0.06 }))
      .filter((p) => p.life > 0);
  }, []);

  return { points, decay };
}
