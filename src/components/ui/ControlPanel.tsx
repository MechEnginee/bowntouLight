// components/ui/ControlPanel.tsx — 우측 패널 (다중 선택 대응)
// 선택된 픽스처 전체에 On/Off·밝기·각도·색을 적용한다.
// 표시 값은 대표(앵커) 픽스처 기준, 컨트롤 노출은 선택 전체의 공통 속성만.

import * as THREE from "three";
import { useSceneStore, type Vec3 } from "../../store/scene-store";
import { NumberField } from "./NumberField";
import { RgbRow } from "./RgbRow";
import { ColorPalette } from "./ColorPalette";
import { ImagePicker } from "./ImagePicker";
import { EyeDropperButton } from "./EyeDropperButton";
import { hexToRgb, rgbToHex } from "./color-utils";

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  decimals = 0,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  // 슬라이더로 나온 값이 범위를 벗어나지 않도록 입력 커밋 시 clamp
  const commit = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "#b0b0c0",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <NumberField
          value={value}
          onCommit={commit}
          suffix={suffix}
          decimals={decimals}
          width={52}
          align="right"
        />
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

const AXIS_LABELS = ["X", "Y", "Z"] as const;
const r2d = THREE.MathUtils.radToDeg;
const d2r = THREE.MathUtils.degToRad;

/** Position/Rotation/Scale 한 줄 — 축 3개(X/Y/Z) 숫자 입력. rotation은 도 단위로 표시하고
 * 내부적으로 라디안으로 변환해 저장한다. */
function TransformRow({
  label,
  selectedIds,
  values,
  prop,
  toDisplay = (v: number) => v,
  fromDisplay = (v: number) => v,
}: {
  label: string;
  selectedIds: string[];
  values: Vec3;
  prop: "position" | "rotation" | "scale";
  toDisplay?: (v: number) => number;
  fromDisplay?: (v: number) => number;
}) {
  const setAxisValue = useSceneStore((s) => s.setAxisValue);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#7a7a9a", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        {AXIS_LABELS.map((axisLabel, axis) => (
          <div key={axis} style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 9,
                color: "#555570",
                textAlign: "center",
                marginBottom: 1,
              }}
            >
              {axisLabel}
            </div>
            <NumberField
              value={toDisplay(values[axis])}
              width="100%"
              onCommit={(v) =>
                setAxisValue(
                  selectedIds,
                  prop,
                  axis as 0 | 1 | 2,
                  fromDisplay(v),
                )
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ControlPanel({ width = 260 }: { width?: number }) {
  const fixtures = useSceneStore((s) => s.fixtures);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const anchorId = useSceneStore((s) => s.anchorId);
  const update = useSceneStore((s) => s.update);
  const setFixtureImage = useSceneStore((s) => s.setFixtureImage);

  const panelStyle: React.CSSProperties = {
    width,
    flex: `0 0 ${width}px`,
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

  // 미니빔(par)도 실기(LED Mini Beam 251)처럼 Pan/Tilt/줌을 가진 무빙 픽스처다
  const hasBeam = selected.every(
    (f) => f.type === "movingHead" || f.type === "par",
  );
  const allPar = selected.every((f) => f.type === "par");
  const allMoving = selected.every((f) => f.type === "movingHead");
  const isStrobe = selected.every((f) => f.type === "strobe");
  // 트러스 바는 구조물 — 프레임색만 있고 밝기/On·Off 없음
  const isStructural = selected.every(
    (f) => f.type === "wall" || f.type === "floor" || f.type === "bar",
  );
  const isSurface = selected.every(
    (f) => f.type === "wall" || f.type === "floor",
  );
  const isLight = selected.every((f) => f.type === "light");
  // 색을 가진 오브젝트: 빔(무빙/미니빔)·스트로브·광원·트러스 바·벽/바닥
  const hasColor = selected.every(
    (f) =>
      f.type === "movingHead" ||
      f.type === "par" ||
      f.type === "strobe" ||
      f.type === "wall" ||
      f.type === "floor" ||
      f.type === "light" ||
      f.type === "bar",
  );
  // 벽·바닥·광원·트러스 바는 RGB 입력
  const useRgbColor = isStructural || isLight;
  const hasDimmer = selected.every(
    (f) =>
      f.type !== "hazer" &&
      f.type !== "wall" &&
      f.type !== "floor" &&
      f.type !== "bar",
  );
  const allOn = selected.every((f) => f.on);
  const multi = selected.length > 1;

  // 타입별 빔각 범위: 미니빔 1~12°(펜슬 빔) / 워시 무빙 5~60° / 혼합 1~60°
  const angleMin = allPar ? 1 : allMoving ? 5 : 1;
  const angleMax = allPar ? 12 : allMoving ? 60 : 60;

  return (
    <aside style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#4A90D9", marginBottom: 4 }}>
        제어 패널
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
        {multi ? `${selected.length}개 선택됨` : primary.name}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 14 }}>
        {multi
          ? `대표: ${primary.name}`
          : `${primary.mount} · (${primary.position.map((n) => n.toFixed(1)).join(", ")})`}
      </div>

      {/* On/Off (선택 전체) — 구조물(벽/바닥/트러스)은 해당 없음 */}
      {!isStructural && (
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
      )}

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

      {hasBeam && (
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
            label="빔 폭 (Zoom)"
            value={primary.angle}
            min={angleMin}
            max={angleMax}
            step={0.5}
            decimals={1}
            suffix="°"
            onChange={(v) => update(selectedIds, { angle: v })}
          />
          <div style={{ fontSize: 11, color: "#666", marginTop: -8, marginBottom: 12 }}>
            빔이 넓어질수록 빛의 세기는 약해집니다
          </div>
        </>
      )}

      {isStrobe && (
        <>
          <Slider
            label="플래시 속도 (Rate)"
            value={primary.strobeRate}
            min={0}
            max={20}
            step={0.5}
            decimals={1}
            suffix="Hz"
            onChange={(v) => update(selectedIds, { strobeRate: v })}
          />
          <div style={{ fontSize: 11, color: "#666", marginTop: -8, marginBottom: 12 }}>
            0 Hz = 상시 점등
          </div>
        </>
      )}

      {hasColor && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#b0b0c0", marginBottom: 6 }}>
            {isSurface
              ? "표면색 (RGB)"
              : isLight
                ? "광원색 (RGB)"
                : isStructural
                  ? "프레임색 (RGB)"
                  : "색상 (Color)"}
          </div>
          {useRgbColor ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ColorPalette
                value={primary.color}
                onPick={(hex) => update(selectedIds, { color: hex })}
              />
              <RgbRow
                value={hexToRgb(primary.color)}
                onChange={(ch, v) => {
                  const rgb = hexToRgb(primary.color);
                  rgb[ch] = v;
                  update(selectedIds, { color: rgbToHex(rgb) });
                }}
                onPickAll={(rgb) => update(selectedIds, { color: rgbToHex(rgb) })}
              />
            </div>
          ) : (
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
              <span style={{ fontFamily: "monospace", fontSize: 13, color: "#b0b0c0", flex: 1 }}>
                {primary.color.toUpperCase()}
              </span>
              <EyeDropperButton
                onPick={(hex) => update(selectedIds, { color: hex })}
              />
            </div>
          )}
        </div>
      )}

      {isSurface && (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#b0b0c0", marginBottom: 6 }}>표면 이미지</div>
            <ImagePicker
              value={primary.imageUrl ?? null}
              onChange={(url) => setFixtureImage(selectedIds, url)}
              label="이미지"
            />
            <div style={{ fontSize: 10.5, color: "#666", marginTop: 5, lineHeight: 1.5 }}>
              이미지를 넣으면 표면색 대신 이미지가 벽/바닥에 입혀집니다.
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6, marginBottom: 10 }}>
            벽/바닥은 목록에서 선택 후 기즈모로
            <br />
            이동(1)·회전(2)·크기(3) 조절합니다.
          </div>
        </>
      )}

      {/* Position/Rotation/Scale — 기즈모(1/2/3)와 동일한 값을 숫자로 직접 입력/수정 */}
      <div
        style={{
          marginTop: 4,
          marginBottom: 14,
          paddingTop: 12,
          borderTop: "1px solid #2a2a40",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#4A90D9", marginBottom: 10 }}>
          트랜스폼 (Transform)
        </div>
        <TransformRow
          label="Position (m)"
          selectedIds={selectedIds}
          values={primary.position}
          prop="position"
        />
        <TransformRow
          label="Rotation (°)"
          selectedIds={selectedIds}
          values={primary.rotation}
          prop="rotation"
          toDisplay={r2d}
          fromDisplay={d2r}
        />
        <TransformRow
          label="Scale"
          selectedIds={selectedIds}
          values={primary.scale}
          prop="scale"
        />
      </div>

      {/* 선택 삭제 */}
      <button
        onClick={() => useSceneStore.getState().removeObjects(selectedIds)}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: 6,
          border: "1px solid #663333",
          cursor: "pointer",
          fontSize: 13,
          background: "#2a1a1a",
          color: "#e08080",
        }}
      >
        선택 삭제 (Delete)
      </button>
    </aside>
  );
}
