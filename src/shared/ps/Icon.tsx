import type { CSSProperties } from "react";

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Material Symbols Outlined glyph, weight 300 (the design system icon set). */
export function Icon({ name, size = 20, className = "", style }: IconProps) {
  return (
    <span className={`ps-icon ${className}`} aria-hidden="true" style={{ fontSize: size, ...style }}>
      {name}
    </span>
  );
}
