// components/ui/ControlPanel.tsx — 우측 패널 (다중 선택 대응)
// 선택된 픽스처 전체에 On/Off·밝기·각도·색을 적용한다.
// 표시 값은 대표(앵커) 픽스처 기준, 컨트롤 노출은 선택 전체의 공통 속성만.

import { useSceneStore } from "../../store/scene-store";

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#b0b0c0",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "#4A90D9", fontFamily: "monospace" }}>
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#4A90D9" }}
      />
    </div>
  );
}

export function ControlPanel() {
  const fixtures = useSceneStore((s) => s.fixtures);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const anchorId = useSceneStore((s) => s.anchorId);
  const update = useSceneStore((s) => s.update);

  const panelStyle: React.CSSProperties = {
    width: 260,
    flex: "0 0 260px",
    height: "100%",
    background: "#1a1a2e",
    color: "#E0E0E0",
    borderLeft: "1px solid #2a2a40",
    overflowY: "auto",
    padding: "12px 14px",
  };

  if (selectedIds.length === 0) {
    return (
      <aside style={panelStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#4A90D9", marginBottom: 10 }}>
          제어 패널
        </div>
        <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>
          픽스처를 선택하세요.
          <br />
          <br />
          · 클릭 / Ctrl·Shift+클릭 → 다중 선택
          <br />· 빈 공간 드래그 → 박스 선택
          <br />· 선택 후 우클릭 → 라이트 On
          <br />· 화살표 드래그 → 이동
        </div>
      </aside>
    );
  }

  const selected = selectedIds.map((id) => fixtures[id]).filter(Boolean);
  const primary =
    (anchorId && selected.find((f) => f.id === anchorId)) || selected[0];

  const isMoving = selected.every((f) => f.type === "movingHead");
  const hasColor = selected.every(
    (f) => f.type === "movingHead" || f.type === "par",
  );
  const hasDimmer = selected.every((f) => f.type !== "hazer");
  const allOn = selected.every((f) => f.on);
  const multi = selected.length > 1;

  return (
    <aside style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#4A90D9", marginBottom: 4 }}>
        제어 패널
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
        {multi ? `${selected.length}개 선택됨` : primary.id}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 14 }}>
        {multi
          ? `대표: ${primary.id}`
          : `${primary.mount} · (${primary.position.map((n) => n.toFixed(1)).join(", ")})`}
      </div>

      {/* On/Off (선택 전체) */}
      <button
        onClick={() => update(selectedIds, { on: !allOn })}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: 16,
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 700,
          background: allOn ? "#FF6B35" : "#333",
          color: allOn ? "#fff" : "#aaa",
        }}
      >
        {allOn ? "● 전체 ON" : "○ 전체 OFF"}
      </button>

      {hasDimmer && (
        <Slider
          label="밝기 (Dimmer)"
          value={primary.dimmer * 100}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => update(selectedIds, { dimmer: v / 100 })}
        />
      )}

      {isMoving && (
        <>
          <Slider
            label="Pan (좌우)"
            value={primary.pan}
            min={0}
            max={540}
            suffix="°"
            onChange={(v) => update(selectedIds, { pan: v })}
          />
          <Slider
            label="Tilt (상하)"
            value={primary.tilt}
            min={0}
            max={270}
            suffix="°"
            onChange={(v) => update(selectedIds, { tilt: v })}
          />
          <Slider
            label="빔 각도 (Beam)"
            value={primary.angle}
            min={5}
            max={60}
            suffix="°"
            onChange={(v) => update(selectedIds, { angle: v })}
          />
        </>
      )}

      {hasColor && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#b0b0c0", marginBottom: 6 }}>
            색상 (Color)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={primary.color}
              onChange={(e) => update(selectedIds, { color: e.target.value })}
              style={{
                width: 48,
                height: 36,
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
            />
            <span style={{ fontFamily: "monospace", fontSize: 13, color: "#b0b0c0" }}>
              {primary.color.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
