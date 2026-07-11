// components/ui/ResizeHandle.tsx
// 패널 사이의 드래그 리사이즈 손잡이. vertical=좌우 폭 조절(세로선), horizontal=위아래 높이 조절(가로선).
// onDelta는 드래그로 움직인 만큼의 픽셀 델타(clientX/Y 변화량)를 그대로 넘긴다 —
// 호출부가 "늘어나는 방향"을 패널 위치에 맞게 부호를 정해 상태에 반영한다.

import { useEffect, useRef, useState } from "react";

export function ResizeHandle({
  orientation,
  onDelta,
}: {
  orientation: "vertical" | "horizontal";
  onDelta: (deltaPx: number) => void;
}) {
  const dragging = useRef<{ last: number } | null>(null);
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const cur = orientation === "vertical" ? e.clientX : e.clientY;
      const delta = cur - dragging.current.last;
      dragging.current.last = cur;
      if (delta !== 0) onDelta(delta);
    };
    const onUp = () => {
      dragging.current = null;
      setActive(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [orientation, onDelta]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { last: orientation === "vertical" ? e.clientX : e.clientY };
    setActive(true);
    e.preventDefault();
  };

  const highlighted = hover || active;
  const thickness = 6;

  return (
    <div
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: `0 0 ${thickness}px`,
        width: orientation === "vertical" ? thickness : undefined,
        height: orientation === "horizontal" ? thickness : undefined,
        cursor: orientation === "vertical" ? "col-resize" : "row-resize",
        background: "transparent",
        position: "relative",
        touchAction: "none",
        zIndex: 5,
      }}
    >
      <div
        style={{
          position: "absolute",
          [orientation === "vertical" ? "left" : "top"]: thickness / 2 - 1,
          [orientation === "vertical" ? "top" : "left"]: 0,
          width: orientation === "vertical" ? 2 : "100%",
          height: orientation === "horizontal" ? 2 : "100%",
          background: highlighted ? "#4A90D9" : "#2a2a40",
          transition: "background 100ms",
        }}
      />
    </div>
  );
}
