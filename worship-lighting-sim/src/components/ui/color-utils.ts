// components/ui/color-utils.ts
// hex ↔ RGB 변환 헬퍼 (RgbRow 등에서 공용).

export type Rgb = [number, number, number];

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** "#rrggbb" → [r,g,b] */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** [r,g,b] → "#rrggbb" */
export function rgbToHex([r, g, b]: Rgb): string {
  const to2 = (v: number) => clamp255(v).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
