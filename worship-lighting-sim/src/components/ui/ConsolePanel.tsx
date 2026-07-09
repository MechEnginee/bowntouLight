// components/ui/ConsolePanel.tsx
// 하단 고정 콘솔 패널 — Avolites Tiger Touch II 레이아웃 모사(픽셀 복제 아님, 배치·조작 감각 재현).
// 밝은 회색 바디 + 어두운 베젤(실기기 느낌) — 상단 터치스크린(그룹/룩) + 하단 페이더 스트립.
// 접으면 헤더 바만 남아 3D 캔버스 공간을 돌려준다. 펼쳐진 상태에선 상단 가장자리를
// 드래그해 높이를 직접 조절할 수 있다(height/onHeightChange는 App이 관리).

import { useState } from "react";
import { TouchScreen } from "./console/TouchScreen";
import { FaderStrip } from "./console/FaderStrip";
import { ResizeHandle } from "./ResizeHandle";

const HEADER_HEIGHT = 30;

export function ConsolePanel({
  height,
  onHeightChange,
}: {
  height: number;
  onHeightChange: (h: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      data-testid="console-panel"
      style={{
        flex: `0 0 ${collapsed ? HEADER_HEIGHT : height}px`,
        display: "flex",
        flexDirection: "column",
        background: "#c9c9ce",
        borderTop: "2px solid #8c8c92",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}
    >
      {/* 상단 가장자리 드래그 = 콘솔 높이 조절 (접힌 상태에선 비활성) */}
      {!collapsed && (
        <ResizeHandle
          orientation="horizontal"
          onDelta={(d) => onHeightChange(height - d)}
        />
      )}

      {/* 헤더 (로고 + 접기 토글) */}
      <div
        style={{
          height: HEADER_HEIGHT,
          flex: `0 0 ${HEADER_HEIGHT}px`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          background: "linear-gradient(180deg, #dcdce0, #b8b8be)",
          borderBottom: collapsed ? "none" : "1px solid #8c8c92",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#2a2a3a",
            letterSpacing: 0.3,
          }}
        >
          🎚 Bowntou Console
        </span>
        <span style={{ fontSize: 10, color: "#5a5a66" }}>Groups · Looks · Playback</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "콘솔 펼치기" : "콘솔 접기"}
          style={{
            border: "1px solid #8c8c92",
            background: "#e4e4e8",
            color: "#3a3a46",
            borderRadius: 4,
            fontSize: 11,
            padding: "2px 10px",
            cursor: "pointer",
          }}
        >
          {collapsed ? "▲ 펼치기" : "▼ 접기"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div style={{ flex: "1 1 auto", minHeight: 0, padding: "8px 12px 4px" }}>
            <TouchScreen />
          </div>
          <div
            style={{
              flex: `0 0 auto`,
              borderTop: "2px solid #8c8c92",
              background: "linear-gradient(180deg, #cfcfd4, #bcbcc2)",
            }}
          >
            <FaderStrip />
          </div>
        </>
      )}
    </div>
  );
}
