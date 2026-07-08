// components/ui/NumberField.tsx
// 숫자 입력 필드(로컬 버퍼링). 편집 중에는 타이핑한 문자열을 유지하고,
// blur/Enter에서만 파싱해 커밋한다 → 외부(스토어) 값이 바뀌어도 타이핑이 끊기지 않음.
// 슬라이더 값 표시, 트랜스폼 X/Y/Z, 광원 위치 등 여러 곳에서 공용으로 쓴다.

import { useEffect, useState } from "react";

export function NumberField({
  value,
  onCommit,
  suffix,
  decimals = 2,
  width,
  align = "center",
}: {
  value: number;
  onCommit: (v: number) => void;
  suffix?: string;
  /** 표시 소수 자릿수 (정수 표시는 0) */
  decimals?: number;
  width?: number | string;
  align?: "center" | "right" | "left";
}) {
  const fmt = (v: number) => v.toFixed(decimals);
  const [text, setText] = useState(() => fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, decimals]);

  const commit = () => {
    const v = parseFloat(text);
    if (Number.isFinite(v)) onCommit(v);
    else setText(fmt(value));
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setText(fmt(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        style={{
          width: width ?? 56,
          boxSizing: "border-box",
          background: "#12121f",
          border: "1px solid #333350",
          borderRadius: 4,
          color: "#E0E0E0",
          fontFamily: "monospace",
          fontSize: 12,
          padding: "3px 4px",
          textAlign: align,
        }}
      />
      {suffix && (
        <span style={{ fontSize: 11, color: "#7a7a9a", fontFamily: "monospace" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}
