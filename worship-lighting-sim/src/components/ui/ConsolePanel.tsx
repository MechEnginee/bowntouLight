// components/ui/ConsolePanel.tsx
// 하단 고정 콘솔 패널 — Avolites Tiger Touch II 레이아웃 모사(픽셀 복제 아님, 배치·조작 감각 재현).
// 밝은 회색 바디 + 어두운 베젤(실기기 느낌) — 상단 터치스크린(그룹/룩) + 하단 페이더 스트립.
// 접으면 헤더 바만 남아 3D 캔버스 공간을 돌려준다.

import { useState } from "react";
import { TouchScreen } from "./console/TouchScreen";
import { FaderStrip } from "./console/FaderStrip";

const EXPANDED_HEIGHT = 300;
const HEADER_HEIGHT = 30;

export function ConsolePanel() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        flex: `0 0 ${collapsed ? HEADER_HEIGHT : EXPANDED_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        background: "#c9c9ce",
        borderTop: "2px solid #8c8c92",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.4)",
        overflow: "hidden",
        transition: "flex-basis 120ms ease",
      }}
    >
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
          <div style={{ flex: `0 0 auto`, borderTop: "1px solid #a8a8ae", background: "#1a1a1e" }}>
            <FaderStrip />
          </div>
        </>
      )}
    </div>
  );
}
