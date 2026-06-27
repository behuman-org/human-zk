/**
 * RippleGrid — adaptado de React Bits (DavidHDev/react-bits).
 * Grilla animada con ripples que siguen el cursor.
 */
import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useRef, type HTMLAttributes } from "react";
import { useReducedMotion } from "../../../hooks/useReducedMotion";
import "./RippleGrid.css";

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

export interface RippleGridProps extends HTMLAttributes<HTMLDivElement> {
  enableRainbow?: boolean;
  gridColor?: string;
  rippleIntensity?: number;
  gridSize?: number;
  gridThickness?: number;
  fadeDistance?: number;
  vignetteStrength?: number;
  glowIntensity?: number;
  opacity?: number;
  gridRotation?: number;
  mouseInteraction?: boolean;
  mouseInteractionRadius?: number;
  /** Rastrea el cursor en viewport (útil con pointer-events: none en el padre). */
  globalPointer?: boolean;
}

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;

float pi = 3.141592;

mat2 rotate(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  if (gridRotation != 0.0) {
    uv = rotate(gridRotation * pi / 180.0) * uv;
  }

  float dist = length(uv);
  float func = sin(pi * (iTime - dist));
  vec2 rippleUv = uv + uv * func * rippleIntensity;

  if (mouseInteraction && mouseInfluence > 0.0) {
    vec2 mouseUv = (mousePosition * 2.0 - 1.0);
    mouseUv.x *= iResolution.x / iResolution.y;
    float mouseDist = length(uv - mouseUv);
    float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));
        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.55;
  }

  vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
  vec2 b = abs(a);

  float aaWidth = 0.5;
  vec2 smoothB = vec2(
    smoothstep(0.0, aaWidth, b.x),
    smoothstep(0.0, aaWidth, b.y)
  );

  vec3 color = vec3(0.0);
  color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
  color += exp(-gridThickness * smoothB.y);
  color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
  color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

  if (glowIntensity > 0.0) {
    color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
    color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
  }

    float ddd = mix(0.85, 1.0, exp(-1.35 * clamp(pow(dist, fadeDistance), 0.0, 1.0)));

    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignetteRaw = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    float vignette = mix(0.9, 1.0, clamp(vignetteRaw, 0.0, 1.0));

  vec3 t;
  if (enableRainbow) {
    t = vec3(
      uv.x * 0.5 + 0.5 * sin(iTime),
      uv.y * 0.5 + 0.5 * cos(iTime),
      pow(cos(iTime), 4.0)
    ) + 0.5;
  } else {
    t = gridColor;
  }

  float finalFade = ddd * vignette;
  float alpha = length(color) * finalFade * opacity;
  gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}`;

export function RippleGrid({
  enableRainbow = false,
  gridColor = "#38bdf8",
  rippleIntensity = 0.04,
  gridSize = 9,
  gridThickness = 12,
  fadeDistance = 1.5,
  vignetteStrength = 2,
  glowIntensity = 0.08,
  opacity = 0.28,
  gridRotation = 0,
  mouseInteraction = true,
  mouseInteractionRadius = 0.5,
  globalPointer = false,
  className = "",
  style,
  ...rest
}: RippleGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePositionRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseInfluenceRef = useRef(0);
  const uniformsRef = useRef<Record<string, { value: unknown }> | null>(null);
  const reducedMotion = useReducedMotion();
  const activeMouse = mouseInteraction && !reducedMotion;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true,
    });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    container.appendChild(gl.canvas);

    const uniforms: Record<string, { value: unknown }> = {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      enableRainbow: { value: enableRainbow },
      gridColor: { value: new Color(...hexToRgb(gridColor)) },
      rippleIntensity: { value: rippleIntensity },
      gridSize: { value: gridSize },
      gridThickness: { value: gridThickness },
      fadeDistance: { value: fadeDistance },
      vignetteStrength: { value: vignetteStrength },
      glowIntensity: { value: glowIntensity },
      opacity: { value: opacity },
      gridRotation: { value: gridRotation },
      mouseInteraction: { value: activeMouse },
      mousePosition: { value: new Float32Array([0.5, 0.5]) },
      mouseInfluence: { value: 0 },
      mouseInteractionRadius: { value: mouseInteractionRadius },
    };

    uniformsRef.current = uniforms;

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: VERT, fragment: FRAG, uniforms });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      if (!container) return;
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w, h);
      const res = uniforms.iResolution.value as Float32Array;
      res[0] = w;
      res[1] = h;
    };

    const setTargetFromClient = (clientX: number, clientY: number) => {
      if (globalPointer) {
        targetMouseRef.current = {
          x: clientX / window.innerWidth,
          y: 1 - clientY / window.innerHeight,
        };
      } else {
        const rect = container.getBoundingClientRect();
        targetMouseRef.current = {
          x: (clientX - rect.left) / rect.width,
          y: 1 - (clientY - rect.top) / rect.height,
        };
      }
      mouseInfluenceRef.current = 1;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!activeMouse) return;
      setTargetFromClient(e.clientX, e.clientY);
    };

    const handlePointerLeave = () => {
      if (!activeMouse || globalPointer) return;
      mouseInfluenceRef.current = 0;
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
    resize();

    if (activeMouse) {
      if (globalPointer) {
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("pointerleave", handlePointerLeave);
      } else {
        container.addEventListener("pointermove", handlePointerMove, { passive: true });
        container.addEventListener("pointerleave", handlePointerLeave);
      }
    }

    let raf = 0;
    const render = (t: number) => {
      raf = requestAnimationFrame(render);
      uniforms.iTime.value = t * 0.001;

      const lerpFactor = 0.14;
      mousePositionRef.current.x +=
        (targetMouseRef.current.x - mousePositionRef.current.x) * lerpFactor;
      mousePositionRef.current.y +=
        (targetMouseRef.current.y - mousePositionRef.current.y) * lerpFactor;

      const currentInfluence = uniforms.mouseInfluence.value as number;
      const targetInfluence = mouseInfluenceRef.current;
      uniforms.mouseInfluence.value = currentInfluence + (targetInfluence - currentInfluence) * 0.08;

      const mouseUniform = uniforms.mousePosition.value as Float32Array;
      mouseUniform[0] = mousePositionRef.current.x;
      mouseUniform[1] = mousePositionRef.current.y;

      renderer.render({ scene: mesh });
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      if (activeMouse) {
        if (globalPointer) {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerleave", handlePointerLeave);
        } else {
          container.removeEventListener("pointermove", handlePointerMove);
          container.removeEventListener("pointerleave", handlePointerLeave);
        }
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (gl.canvas.parentElement === container) container.removeChild(gl.canvas);
    };
  }, [
    activeMouse,
    enableRainbow,
    gridColor,
    rippleIntensity,
    gridSize,
    gridThickness,
    fadeDistance,
    vignetteStrength,
    glowIntensity,
    opacity,
    gridRotation,
    mouseInteractionRadius,
    globalPointer,
  ]);

  return (
    <div
      ref={containerRef}
      className={`ripple-grid ${className}`.trim()}
      style={style}
      {...rest}
    />
  );
}
