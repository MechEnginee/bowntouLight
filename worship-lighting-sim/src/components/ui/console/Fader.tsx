// components/ui/console/Fader.tsx
// 실기기 느낌의 세로 페이더 — 커스텀 div 드래그(포인터 캡처)로 구현.
// 더블클릭 = 풀(1.0)로 리셋.

import { useRef } from "react";

interface Props {
  level: number; // 0..1
  onChange: (v: number) => void;
  onDoubleClick?: () => void;
  height?: number;
  accent?: string;
  disabled?: boolean;
  /** 테스트/접근성용 식별자 */
  label?: string;
}

const CAP_H = 22;

export function Fader({ level, onChange, onDoubleClick, height = 140, accent = "#4A90D9", disabled, label }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(t);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientY(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setFromClientY(e.clientY);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const capY = (1 - level) * Math.max(0, height - CAP_H);

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      aria-label={label}
      data-fader={label}
      data-level={level}
      style={{
        position: "relative",
        width: 30,
        height,
        background: "#111114",
        borderRadius: 4,
        border: "1px solid #3a3a3a",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)",
        cursor: disabled ? "default" : "ns-resize",
        opacity: disabled ? 0.35 : 1,
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {/* 눈금 */}
      <div
        style={{
          position: "absolute",
          inset: "6px 4px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ height: 1, background: "#333" }} />
        ))}
      </div>
      {/* 캡 */}
      <div
        style={{
          position: "absolute",
          left: 2,
          top: capY,
          width: 26,
          height: CAP_H,
          borderRadius: 3,
          background: `linear-gradient(180deg, #fff2 0%, transparent 40%), ${accent}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.35)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
