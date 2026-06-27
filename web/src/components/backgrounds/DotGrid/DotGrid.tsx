/**
 * DotGrid — adaptado de React Bits (puntillismo + reacción suave al cursor).
 */
import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "../../../hooks/useReducedMotion";
import "./DotGrid.css";

type Dot = {
  cx: number;
  cy: number;
  xOffset: number;
  yOffset: number;
};

function hexToRgb(hex: string) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 180, g: 180, b: 180 };
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

export interface DotGridProps {
  className?: string;
  style?: CSSProperties;
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  /** Desplazamiento máximo de cada punto hacia el cursor (0–1). */
  pushStrength?: number;
  globalPointer?: boolean;
}

export function DotGrid({
  className = "",
  style,
  dotSize = 3,
  gap = 26,
  baseColor = "#cfcfcf",
  activeColor = "#38bdf8",
  proximity = 110,
  pushStrength = 0.14,
  globalPointer = true,
}: DotGridProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef({ x: -9999, y: -9999 });
  const reducedMotion = useReducedMotion();

  const baseRgb = useMemo(() => hexToRgb(baseColor), [baseColor]);
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);

  const buildGrid = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const { width, height } = wrap.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = dotSize + gap;
    const cols = Math.floor((width + gap) / cell);
    const rows = Math.floor((height + gap) / cell);
    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;
    const startX = (width - gridW) / 2 + dotSize / 2;
    const startY = (height - gridH) / 2 + dotSize / 2;

    const dots: Dot[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        dots.push({
          cx: startX + col * cell,
          cy: startY + row * cell,
          xOffset: 0,
          yOffset: 0,
        });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    buildGrid();
    const wrap = wrapRef.current;
    if (!wrap) return;

    const ro = new ResizeObserver(() => buildGrid());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [buildGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    const proxSq = proximity * proximity;
    const radius = dotSize / 2;
    const interactive = !reducedMotion;

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      pointerRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!interactive) return;
      updatePointer(e.clientX, e.clientY);
    };

    if (interactive) {
      if (globalPointer) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
      } else {
        canvas.addEventListener("pointermove", onPointerMove, { passive: true });
      }
    }

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      const { x: px, y: py } = pointerRef.current;

      for (const dot of dotsRef.current) {
        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const dsq = dx * dx + dy * dy;

        let r = baseRgb.r;
        let g = baseRgb.g;
        let b = baseRgb.b;
        let targetX = 0;
        let targetY = 0;

        if (interactive && dsq <= proxSq) {
          const dist = Math.sqrt(dsq);
          const t = 1 - dist / proximity;
          r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t * 0.85);
          g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t * 0.85);
          b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t * 0.85);
          targetX = -dx * pushStrength * t;
          targetY = -dy * pushStrength * t;
        }

        dot.xOffset += (targetX - dot.xOffset) * 0.14;
        dot.yOffset += (targetY - dot.yOffset) * 0.14;

        ctx.beginPath();
        ctx.arc(dot.cx + dot.xOffset, dot.cy + dot.yOffset, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      if (interactive && globalPointer) {
        window.removeEventListener("pointermove", onPointerMove);
      } else if (interactive) {
        canvas.removeEventListener("pointermove", onPointerMove);
      }
    };
  }, [
    activeRgb,
    baseRgb,
    dotSize,
    globalPointer,
    proximity,
    pushStrength,
    reducedMotion,
  ]);

  return (
    <div ref={wrapRef} className={`dot-grid ${className}`.trim()} style={style}>
      <canvas ref={canvasRef} className="dot-grid__canvas" aria-hidden="true" />
    </div>
  );
}
