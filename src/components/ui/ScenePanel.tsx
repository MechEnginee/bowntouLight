// components/ui/ScenePanel.tsx
// 좌상단 씬 컨트롤 패널 — 헤더를 잡아 끌어 이동, 접기/펼치기 가능.
//  - 씬 이름(수정) · 내보내기/불러오기(.btw) · Scene 밝기 · 태양광 위치 · 배경색(RGB)
// 화면 공간을 적게 차지하도록 접으면 헤더만 남는다.

import { useEffect, useRef, useState } from "react";
import { useSceneStore } from "../../store/scene-store";
import { NumberField } from "./NumberField";
import { RgbRow } from "./RgbRow";
import { ColorPalette } from "./ColorPalette";
import { ImagePicker } from "./ImagePicker";
import { rgbToHex, hexToRgb } from "./color-utils";
import { buildSceneZip, importSceneZip } from "./scene-bundle";

/** {SceneName}_YYYYMMDDHHMMSS.btw 파일명 */
function exportFileName(name: string): string {
  const safe = (name || "scene").replace(/[\\/:*?"<>|]+/g, "_").trim() || "scene";
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const ts =
    `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}` +
    `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return `${safe}_${ts}.btw`;
}

export function ScenePanel() {
  const sceneName = useSceneStore((s) => s.sceneName);
  const setSceneName = useSceneStore((s) => s.setSceneName);
  const sceneBrightness = useSceneStore((s) => s.sceneBrightness);
  const setSceneBrightness = useSceneStore((s) => s.setSceneBrightness);
  const lightPosition = useSceneStore((s) => s.lightPosition);
  const setLightPosition = useSceneStore((s) => s.setLightPosition);
  const backgroundColor = useSceneStore((s) => s.backgroundColor);
  const setBackgroundChannel = useSceneStore((s) => s.setBackgroundChannel);
  const backgroundImage = useSceneStore((s) => s.backgroundImage);
  const setBackgroundImage = useSceneStore((s) => s.setBackgroundImage);
  const beamGlow = useSceneStore((s) => s.beamGlow);
  const setBeamGlow = useSceneStore((s) => s.setBeamGlow);
  const showGrid = useSceneStore((s) => s.showGrid);
  const setShowGrid = useSceneStore((s) => s.setShowGrid);
  const shadowsEnabled = useSceneStore((s) => s.shadowsEnabled);
  const setShadowsEnabled = useSceneStore((s) => s.setShadowsEnabled);

  const [pos, setPos] = useState({ x: 12, y: 52 }); // 좌상단 3D 뷰 컨트롤 버튼 아래로
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 헤더 드래그 이동 ───
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - d.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 30, e.clientY - d.dy)),
      });
    };
    const onUp = () => (dragRef.current = null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const onHeaderDown = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };

  // ─── 내보내기 / 불러오기 (.btw) ───
  const handleExport = () => {
    const data = useSceneStore.getState().exportScene();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(data.sceneName);
    a.click();
    URL.revokeObjectURL(url);
  };
  // ZIP 번들 내보내기 — .btw + img/ + sound/
  const [zipBusy, setZipBusy] = useState(false);
  const handleExportZip = async () => {
    setZipBusy(true);
    try {
      const { blob, name } = await buildSceneZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("ZIP 내보내기에 실패했습니다.");
    } finally {
      setZipBusy(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // .zip은 번들 임포터로, 그 외(.btw/JSON)는 기존 텍스트 임포터로
    if (/\.zip$/i.test(file.name)) {
      importSceneZip(file).then((res) => {
        if (!res.ok) alert(`불러오기 실패: ${res.error}`);
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const res = useSceneStore.getState().importScene(data);
        if (!res.ok) alert(`불러오기 실패: ${res.error}`);
      } catch {
        alert("불러오기 실패: 파일을 읽을 수 없습니다 (.btw/JSON)");
      }
    };
    reader.readAsText(file);
  };

  const labelStyle: React.CSSProperties = { color: "#7a7a9a", fontSize: 10, marginBottom: 4 };

  return (
    <div
      style={{
        position: "absolute",
        top: pos.y,
        left: pos.x,
        width: 220,
        color: "#c8c8d0",
        font: "12px/1.4 monospace",
        background: "#1a1a2ee6",
        borderRadius: 6,
        border: "1px solid #2a2a40",
        userSelect: "none",
      }}
    >
      {/* 헤더 (드래그 핸들 + 접기 토글) */}
      <div
        onPointerDown={onHeaderDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 10px",
          cursor: "move",
          borderBottom: collapsed ? "none" : "1px solid #2a2a40",
        }}
      >
        <span style={{ color: "#4A90D9", fontWeight: 700, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          🎛 {sceneName || "씬"}
        </span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          title={collapsed ? "펼치기" : "접기"}
          style={{
            border: "none",
            background: "transparent",
            color: "#9ab8e0",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
            padding: 2,
          }}
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: "8px 10px 10px" }}>
          {/* 씬 이름 */}
          <div style={labelStyle}>씬 이름</div>
          <input
            type="text"
            value={sceneName}
            onChange={(e) => setSceneName(e.target.value)}
            placeholder="씬 이름"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#12121f",
              border: "1px solid #333350",
              borderRadius: 4,
              color: "#E0E0E0",
              fontSize: 13,
              fontWeight: 700,
              padding: "5px 7px",
              marginBottom: 8,
            }}
          />

          {/* 내보내기 / 불러오기 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button
              onClick={handleExport}
              style={{
                flex: 1,
                padding: "5px",
                borderRadius: 4,
                border: "1px solid #3a5a3a",
                background: "#1a2a1a",
                color: "#9ad09a",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              내보내기
            </button>
            <button
              onClick={handleExportZip}
              disabled={zipBusy}
              title="소스(이미지·음원)와 .btw를 ZIP으로 묶어 내보내기"
              style={{
                flex: 1,
                padding: "5px",
                borderRadius: 4,
                border: "1px solid #3a5a3a",
                background: "#1a2a1a",
                color: "#9ad09a",
                cursor: zipBusy ? "default" : "pointer",
                opacity: zipBusy ? 0.6 : 1,
                fontSize: 11,
              }}
            >
              {zipBusy ? "ZIP…" : "ZIP"}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                padding: "5px",
                borderRadius: 4,
                border: "1px solid #3a3a5a",
                background: "#1a1a2a",
                color: "#9ab8e0",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              불러오기
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".btw,application/json,.json,.zip"
              onChange={handleImportFile}
              style={{ display: "none" }}
            />
          </div>

          {/* Scene 밝기 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 5,
              paddingTop: 8,
              borderTop: "1px solid #2a2a40",
            }}
          >
            <span style={{ color: "#4A90D9", fontWeight: 700 }}>Scene 밝기</span>
            <NumberField
              value={sceneBrightness * 100}
              onCommit={(v) => setSceneBrightness(Math.max(0, Math.min(200, v)) / 100)}
              suffix="%"
              decimals={0}
              width={48}
              align="right"
            />
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={sceneBrightness * 100}
            onChange={(e) => setSceneBrightness(parseFloat(e.target.value) / 100)}
            style={{ width: "100%", accentColor: "#4A90D9" }}
          />

          {/* 빔 글로우 — 반짝이는 볼류메트릭 빛 세기 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
              marginBottom: 5,
              paddingTop: 8,
              borderTop: "1px solid #2a2a40",
            }}
          >
            <span style={{ color: "#4A90D9", fontWeight: 700 }}>빔 글로우</span>
            <NumberField
              value={beamGlow * 100}
              onCommit={(v) => setBeamGlow(Math.max(0, Math.min(200, v)) / 100)}
              suffix="%"
              decimals={0}
              width={48}
              align="right"
            />
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={beamGlow * 100}
            onChange={(e) => setBeamGlow(parseFloat(e.target.value) / 100)}
            style={{ width: "100%", accentColor: "#4A90D9" }}
          />
          <div style={{ fontSize: 10.5, color: "#666", marginTop: 3, lineHeight: 1.5 }}>
            빔의 반짝이는 발광 세기 (0%=글로우 끄기)
          </div>

          {/* 격자 그리드 표시 토글 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #2a2a40",
            }}
          >
            <span style={{ color: "#4A90D9", fontWeight: 700 }}>격자 그리드</span>
            <button
              onClick={() => setShowGrid(!showGrid)}
              style={{
                border: "1px solid #3a5a8c",
                borderRadius: 4,
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                background: showGrid ? "#3f6bb0" : "#2a2a32",
                color: showGrid ? "#fff" : "#9a9aa6",
              }}
            >
              {showGrid ? "표시" : "숨김"}
            </button>
          </div>

          {/* 그림자 렌더링(성능) 마스터 토글 — 기본 끔, 작업 후 켜서 확인 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #2a2a40",
            }}
          >
            <span style={{ color: "#4A90D9", fontWeight: 700 }}>그림자 (Shadow)</span>
            <button
              onClick={() => setShadowsEnabled(!shadowsEnabled)}
              title="전역 그림자 렌더링. 작업 중엔 꺼서 가볍게, 완료 후 켜서 그림자를 확인하세요."
              style={{
                border: "1px solid #3a5a8c",
                borderRadius: 4,
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                background: shadowsEnabled ? "#3f6bb0" : "#2a2a32",
                color: shadowsEnabled ? "#fff" : "#9a9aa6",
              }}
            >
              {shadowsEnabled ? "켬" : "끔"}
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: "#666", marginTop: 3, lineHeight: 1.5 }}>
            작업 중엔 꺼서 가볍게 · 완료 후 켜면 그림자가 제대로 보입니다
          </div>

          {/* 태양광 위치 */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #2a2a40" }}>
            <div style={labelStyle}>태양광 위치 (Sun)</div>
            <div style={{ display: "flex", gap: 5 }}>
              {(["X", "Y", "Z"] as const).map((axisLabel, axis) => (
                <div key={axis} style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#555570", textAlign: "center", marginBottom: 1 }}>
                    {axisLabel}
                  </div>
                  <NumberField
                    value={lightPosition[axis]}
                    onCommit={(v) => setLightPosition(axis as 0 | 1 | 2, v)}
                    decimals={1}
                    width="100%"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 배경색 — 팔레트에서 고르거나 RGB로 직접 입력 */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #2a2a40" }}>
            <div style={labelStyle}>배경색</div>
            <ColorPalette
              value={rgbToHex(backgroundColor)}
              onPick={(hex) => hexToRgb(hex).forEach((v, i) => setBackgroundChannel(i as 0 | 1 | 2, v))}
            />
            <div style={{ ...labelStyle, marginTop: 8 }}>RGB 직접 입력</div>
            <RgbRow
              value={backgroundColor}
              onChange={(ch, v) => setBackgroundChannel(ch, v)}
              onPickAll={(rgb) => rgb.forEach((v, i) => setBackgroundChannel(i as 0 | 1 | 2, v))}
            />
            <div style={{ ...labelStyle, marginTop: 10 }}>배경 이미지</div>
            <ImagePicker value={backgroundImage} onChange={setBackgroundImage} label="배경" />
            <div style={{ fontSize: 10.5, color: "#666", marginTop: 5, lineHeight: 1.5 }}>
              구름 등 이미지를 넣으면 배경색 대신 배경으로 표시됩니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
