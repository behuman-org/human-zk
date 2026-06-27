import type { ReactNode } from "react";
import { DotGrid } from "../backgrounds/DotGrid/DotGrid";
import "./DotRegion.css";

export function DotRegion({ children }: { children: ReactNode }) {
  return (
    <div className="dot-region">
      <div className="dot-region__backdrop" aria-hidden="true">
        <DotGrid
          globalPointer
          dotSize={3}
          gap={26}
          baseColor="#c8c8c8"
          activeColor="#7dd3fc"
          proximity={100}
          pushStrength={0.11}
        />
      </div>
      <div className="dot-region__content">{children}</div>
    </div>
  );
}
