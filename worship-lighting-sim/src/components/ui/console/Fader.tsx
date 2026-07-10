// components/ui/console/Fader.tsx
// 실기기(Tiger Touch II) 물리 페이더 재현 — 어두운 슬롯 트랙 + 흰색 캡.
// 커스텀 div 드래그(포인터 캡처)로 구현. 더블클릭 = 풀(1.0)로 리셋.
// accent는 캡 상단의 얇은 컬러 인디케이터로만 쓰인다(할당 종류 구분용).

import { useRef } from "react";

interface Props {
  level: number; // 0..1
  onChange: (v: number) => void;
  onDoubleClick?: () => void;
  /** 고정 픽셀 높이. 생략하면 부모를 100% 채운다(flex 스케일 — 창 크기에 따라 자동 축소/확대) */
  height?: number;
  accent?: string;
  disabled?: boolean;
  /** 테스트/접근성용 식별자 */
  label?: string;
}

const CAP_H = 26;
const WIDTH = 30;

export function Fader({ level, onChange, onDoubleClick, height, accent = "#4A90D9", disabled, label }: Props) {
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

  // 캡 위치를 calc로 계산 → 픽셀 높이를 몰라도 됨(100% 높이에서도 정확). JS 측정 불필요.
  const capInv = Math.max(0, Math.min(1, 1 - level));
  const capTop = `calc((100% - ${CAP_H}px) * ${capInv})`;

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
        flex: height === undefined ? "1 1 0" : "0 0 auto",
        width: WIDTH,
        height: height === undefined ? "100%" : height,
        minHeight: 0,
        background: "linear-gradient(90deg, #1c1c20 0%, #2a2a30 50%, #1c1c20 100%)",
        borderRadius: 3,
        border: "1px solid #0c0c0e",
        boxShadow: "inset 0 2px 5px rgba(0,0,0,0.7)",
        cursor: disabled ? "default" : "ns-resize",
        opacity: disabled ? 0.4 : 1,
        touchAction: "none",
        userSelect: "none",
      }}
    >
      {/* 중앙 슬롯 라인 */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 6,
          bottom: 6,
          width: 2,
          transform: "translateX(-50%)",
          background: "#0a0a0c",
          borderRadius: 2,
          pointerEvents: "none",
        }}
      />
      {/* 캡 (흰색 물리 페이더 노브) */}
      <div
        style={{
          position: "absolute",
          left: 1,
          top: capTop,
          width: WIDTH - 2,
          height: CAP_H,
          borderRadius: 3,
          background: "linear-gradient(180deg, #ffffff 0%, #e6e6ea 45%, #c4c4cc 55%, #f2f2f5 100%)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.9)",
          border: "1px solid #9a9aa2",
          pointerEvents: "none",
        }}
      >
        {/* 캡 상단 컬러 인디케이터 (할당 종류 구분) */}
        <div
          style={{
            position: "absolute",
            left: 3,
            right: 3,
            top: "50%",
            height: 3,
            transform: "translateY(-50%)",
            borderRadius: 2,
            background: disabled ? "#b8b8be" : accent,
          }}
        />
      </div>
    </div>
  );
}
