// components/ui/ColorPalette.tsx
// 프리셋 색 스와치 팔레트 + 네이티브 색 선택기 + 스포이드.
// 벽/바닥 표면색·배경색처럼 hex 한 값을 고르는 곳에서 RGB 입력과 함께 쓴다.

import { EyeDropperButton } from "./EyeDropperButton";

// 표면/배경용 프리셋 — 채도색 + 중성/어두운 톤(배경은 어두운 색이 흔하다)
const SURFACE_PALETTE: string[] = [
  "#ffffff", "#d6d6de", "#9a9aa6", "#5a5a66", "#2a2a32", "#0d0d0d",
  "#ff2a2a", "#ff7a1a", "#ffb000", "#ffe100", "#2ecc40", "#25d0d0",
  "#3aa0ff", "#1e5cff", "#5b3af0", "#e030d0", "#ff6ec7", "#ffd9a0",
  "#8a5a2a", "#3a5a3a", "#243a5a", "#1a1a2e", "#101828", "#000000",
];

const isHex6 = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

/** hex 한 값을 고르는 팔레트 UI. onPick(#rrggbb) 콜백. */
export function ColorPalette({
  value,
  onPick,
}: {
  value: string; // 현재 색 "#rrggbb"
  onPick: (hex: string) => void;
}) {
  const cur = value.toLowerCase();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
        {SURFACE_PALETTE.map((hex) => {
          const active = hex.toLowerCase() === cur;
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onPick(hex)}
              title={hex}
              style={{
                height: 20,
                borderRadius: 3,
                background: hex,
                border: active ? "2px solid #7ec4ff" : "1px solid #33334d",
                boxShadow: active ? "0 0 6px #7ec4ff88" : "none",
                cursor: "pointer",
                padding: 0,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* 네이티브 색 선택기 — label로 감싸 넘치는 히트영역이 인접 요소를 가리지 않게 */}
        <label
          title="색 선택기 (그라데이션 팔레트)"
          style={{
            width: 40,
            height: 26,
            borderRadius: 4,
            border: "1px solid #33334d",
            background: isHex6(value) ? value : "#ffffff",
            cursor: "pointer",
            position: "relative",
            flex: "0 0 auto",
            overflow: "hidden",
          }}
        >
          <input
            type="color"
            value={isHex6(value) ? value : "#ffffff"}
            onChange={(e) => onPick(e.target.value)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
          />
        </label>
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#b0b0c0", flex: 1 }}>
          {value.toUpperCase()}
        </span>
        <EyeDropperButton onPick={onPick} />
      </div>
    </div>
  );
}
