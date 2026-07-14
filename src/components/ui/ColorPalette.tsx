// components/ui/ColorPalette.tsx
// 컴팩트한 색 선택 한 줄 — 스와치를 클릭하면 브라우저 네이티브 그라데이션 팔레트가 열린다.
// 벽/바닥 표면색·배경색 등 hex 한 값을 고르는 곳에서 RGB 입력과 함께 쓴다.

import { EyeDropperButton } from "./EyeDropperButton";

const isHex6 = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

/** hex 한 값을 고르는 컴팩트 팔레트 UI. onPick(#rrggbb) 콜백. */
export function ColorPalette({
  value,
  onPick,
}: {
  value: string; // 현재 색 "#rrggbb"
  onPick: (hex: string) => void;
}) {
  const safe = isHex6(value) ? value : "#ffffff";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* 네이티브 색 선택기(그라데이션 팔레트) — label로 감싸 넘치는 히트영역이 인접 요소를 가리지 않게 */}
      <label
        title="색 선택 (팔레트 열기)"
        style={{
          width: 34,
          height: 24,
          borderRadius: 4,
          border: "1px solid #33334d",
          background: safe,
          cursor: "pointer",
          position: "relative",
          flex: "0 0 auto",
          overflow: "hidden",
        }}
      >
        <input
          type="color"
          value={safe}
          onChange={(e) => onPick(e.target.value)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
        />
      </label>
      <span style={{ fontFamily: "monospace", fontSize: 12, color: "#b0b0c0", flex: 1 }}>
        {value.toUpperCase()}
      </span>
      <EyeDropperButton onPick={onPick} />
    </div>
  );
}
