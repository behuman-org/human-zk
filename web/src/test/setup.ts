import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";

vi.mock("../components/backgrounds/FaultyTerminal/FaultyTerminal", () => ({
  FaultyTerminal: () => null,
}));

vi.mock("../components/backgrounds/DotGrid/DotGrid", () => ({
  DotGrid: () => null,
}));

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

/** Polyfill para jsdom — hooks y CSS media queries en tests. */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
  }

  unobserve() {}

  disconnect() {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

function createWebGLContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    ONE: 1,
    ZERO: 0,
    FUNC_ADD: 0,
    CCW: 0,
    LEQUAL: 0,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 8,
    clearColor: vi.fn(),
    getParameter: vi.fn(() => 8),
    getExtension: vi.fn(() => null),
    viewport: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    blendEquation: vi.fn(),
    depthFunc: vi.fn(),
    depthMask: vi.fn(),
    cullFace: vi.fn(),
    frontFace: vi.fn(),
    colorMask: vi.fn(),
    clear: vi.fn(),
    bindFramebuffer: vi.fn(),
    bindTexture: vi.fn(),
    activeTexture: vi.fn(),
    bindBuffer: vi.fn(),
    useProgram: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniform1i: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    createBuffer: vi.fn(),
    bufferData: vi.fn(),
    createProgram: vi.fn(),
    createShader: vi.fn(),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getProgramParameter: vi.fn(() => true),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    vertexAttribPointer: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    pixelStorei: vi.fn(),
    renderer: null as unknown,
  };
}

/** Canvas mocks — jsdom no implementa getContext nativamente. */
HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
  if (contextType === "webgl2" || contextType === "webgl" || contextType === "experimental-webgl") {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 150;
    return createWebGLContext(canvas);
  }

  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
  };
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
