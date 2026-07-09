// components/ui/console/FaderStrip.tsx
// 콘솔 하단 페이더 스트립 — 실기기 하단 재현.
// Page -/+(비활성) · BO · M(그랜드마스터) · 슬롯 10개(Flash 버튼 + 페이더 + legend)

import { useSceneStore } from "../../../store/scene-store";
import type { FaderSlot } from "../../../store/console-types";
import { Fader } from "./Fader";

function legendFor(
  slot: FaderSlot,
  groups: { id: string; name: string }[],
  looks: { id: string; name: string; values: Record<string, { color?: string }> }[],
): { text: string; color?: string } | null {
  const a = slot.assignment;
  if (!a) return null;
  if (a.kind === "look") {
    const l = looks.find((x) => x.id === a.lookId);
    if (!l) return null;
    const sw = Object.values(l.values).find((v) => v.color)?.color;
    return { text: l.name, color: sw };
  }
  const g = groups.find((x) => x.id === a.groupId);
  return g ? { text: `${g.name} M` } : null;
}

function FaderSlotColumn({ index, slot, legend }: { index: number; slot: FaderSlot; legend: { text: string; color?: string } | null }) {
  const assigned = !!slot.assignment;
  const accent = !assigned ? "#4a4a4a" : slot.assignment!.kind === "look" ? "#4A90D9" : "#5fae5a";

  const flashDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (assigned) useSceneStore.getState().setFlashHeld(index, true);
  };
  const flashUp = () => {
    if (assigned) useSceneStore.getState().setFlashHeld(index, false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 46 }}>
      <button
        onPointerDown={flashDown}
        onPointerUp={flashUp}
        onPointerLeave={flashUp}
        onPointerCancel={flashUp}
        disabled={!assigned}
        title={assigned ? "Flash (누르는 동안 풀 밝기)" : undefined}
        data-flash={`slot-${index + 1}`}
        style={{
          width: 30,
          height: 22,
          borderRadius: 4,
          background: !assigned ? "#26262a" : slot.flashHeld ? "#7ec4ff" : "#2c4a7c",
          border: "1px solid #16161a",
          boxShadow: assigned && slot.flashHeld ? "0 0 8px #7ec4ffaa" : "none",
          cursor: assigned ? "pointer" : "default",
          touchAction: "none",
        }}
      />
      <Fader
        label={`slot-${index + 1}`}
        level={slot.level}
        onChange={(v) => useSceneStore.getState().setFaderLevel(index, v)}
        onDoubleClick={() => assigned && useSceneStore.getState().setFaderLevel(index, 1)}
        disabled={!assigned}
        accent={accent}
        height={130}
      />
      <div
        style={{
          fontSize: 9,
          color: legend ? "#c8d8ee" : "#555",
          textAlign: "center",
          lineHeight: 1.25,
          minHeight: 22,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        {legend?.color && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: legend.color,
              border: "1px solid rgba(255,255,255,0.4)",
            }}
          />
        )}
        <span style={{ wordBreak: "keep-all" }}>{legend ? legend.text : index + 1}</span>
      </div>
    </div>
  );
}

export function FaderStrip() {
  const faderSlots = useSceneStore((s) => s.faderSlots);
  const grandMaster = useSceneStore((s) => s.grandMaster);
  const blackout = useSceneStore((s) => s.blackout);
  const groups = useSceneStore((s) => s.groups);
  const looks = useSceneStore((s) => s.looks);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, padding: "8px 12px 10px" }}>
      {/* Page -/+ (비활성, D-6 실기기 재현용) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ fontSize: 9, color: "#777", marginBottom: 2 }}>Page</div>
        <button disabled style={pageBtnStyle}>
          −
        </button>
        <button disabled style={pageBtnStyle}>
          +
        </button>
      </div>

      {/* BO */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ fontSize: 9, color: "#777" }}>&nbsp;</div>
        <button
          onClick={() => useSceneStore.getState().toggleBlackout()}
          title="블랙아웃 (B)"
          style={{
            width: 46,
            height: 46,
            borderRadius: 6,
            background: blackout ? "#c0392b" : "#2a2a2a",
            border: blackout ? "2px solid #ff6b5b" : "1px solid #444",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            boxShadow: blackout ? "0 0 12px #ff6b5b99" : "none",
          }}
        >
          BO
        </button>
      </div>

      {/* M(그랜드마스터) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 9, color: "#777" }}>&nbsp;</div>
        <Fader
          label="grand-master"
          level={grandMaster}
          onChange={(v) => useSceneStore.getState().setGrandMaster(v)}
          onDoubleClick={() => useSceneStore.getState().setGrandMaster(1)}
          accent="#e0a030"
          height={130}
        />
        <div style={{ fontSize: 10, color: "#e0a030", fontWeight: 700 }}>M</div>
      </div>

      <div style={{ width: 1, alignSelf: "stretch", background: "#3a3a3a", margin: "0 2px" }} />

      {/* 슬롯 1~10 */}
      <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "space-between" }}>
        {faderSlots.map((slot, i) => (
          <FaderSlotColumn key={i} index={i} slot={slot} legend={legendFor(slot, groups, looks)} />
        ))}
      </div>
    </div>
  );
}

const pageBtnStyle: React.CSSProperties = {
  width: 30,
  height: 20,
  borderRadius: 3,
  background: "#242424",
  border: "1px solid #3a3a3a",
  color: "#666",
  fontSize: 12,
  cursor: "not-allowed",
};
