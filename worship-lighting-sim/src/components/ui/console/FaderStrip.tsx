// components/ui/console/FaderStrip.tsx
// 콘솔 하단 물리 페이더 스트립 — Tiger Touch II 실기기 하단부 재현.
// 밝은 회색 바디 + 흰색 캡 페이더 + 파란 Flash LED 버튼.
// 좌측: Playback Page -/+ · BO · M(그랜드마스터). 우측: 슬롯 10개(Flash + 페이더 + legend).

import { useSceneStore } from "../../../store/scene-store";
import type { FaderSlot } from "../../../store/console-types";
import { Fader } from "./Fader";

const FADER_H = 150;

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

function FlashButton({ index, slot, assigned }: { index: number; slot: FaderSlot; assigned: boolean }) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    if (assigned) useSceneStore.getState().setFlashHeld(index, true);
  };
  const up = () => {
    if (assigned) useSceneStore.getState().setFlashHeld(index, false);
  };
  return (
    <button
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      disabled={!assigned}
      title={assigned ? "Flash (누르는 동안 풀 밝기)" : undefined}
      data-flash={`slot-${index + 1}`}
      style={{
        width: 30,
        height: 20,
        borderRadius: 3,
        background: !assigned
          ? "linear-gradient(180deg, #3a3a40, #2a2a30)"
          : slot.flashHeld
            ? "linear-gradient(180deg, #9fd4ff, #4aa0ff)"
            : "linear-gradient(180deg, #3f7fd6, #1f4f9e)",
        border: "1px solid #10233f",
        boxShadow: assigned && slot.flashHeld
          ? "0 0 9px #7ec4ffcc, inset 0 1px 0 rgba(255,255,255,0.6)"
          : "inset 0 1px 0 rgba(255,255,255,0.25)",
        cursor: assigned ? "pointer" : "default",
        touchAction: "none",
      }}
    />
  );
}

function FaderSlotColumn({
  index,
  slot,
  legend,
}: {
  index: number;
  slot: FaderSlot;
  legend: { text: string; color?: string } | null;
}) {
  const assigned = !!slot.assignment;
  const accent = !assigned ? "#9a9aa2" : slot.assignment!.kind === "look" ? "#2f7fe0" : "#3fae5a";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 44 }}>
      <FlashButton index={index} slot={slot} assigned={assigned} />
      <Fader
        label={`slot-${index + 1}`}
        level={slot.level}
        onChange={(v) => useSceneStore.getState().setFaderLevel(index, v)}
        onDoubleClick={() => assigned && useSceneStore.getState().setFaderLevel(index, 1)}
        disabled={!assigned}
        accent={accent}
        height={FADER_H}
      />
      {/* 슬롯 번호 (실기기 프린트) */}
      <div style={{ fontSize: 9, fontWeight: 700, color: "#4a4a52" }}>{index + 1}</div>
      {/* legend 테이프 (실기기 라벨 테이프 느낌) */}
      <div
        style={{
          fontSize: 8.5,
          color: legend ? "#1a2a44" : "#9a9aa2",
          textAlign: "center",
          lineHeight: 1.2,
          minHeight: 20,
          width: 42,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          background: legend ? "#f4e58a" : "transparent",
          borderRadius: 2,
          padding: legend ? "1px 2px" : 0,
        }}
      >
        {legend?.color && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: legend.color,
              border: "1px solid rgba(0,0,0,0.4)",
            }}
          />
        )}
        <span style={{ wordBreak: "keep-all", fontWeight: 600 }}>{legend ? legend.text : ""}</span>
      </div>
    </div>
  );
}

function BpmControl() {
  const bpm = useSceneStore((s) => s.bpm);
  const anyRunning = useSceneStore((s) => s.effects.some((e) => e.running));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ fontSize: 9, color: "#5a5a62", fontWeight: 600 }}>Tempo</div>
      <button
        onClick={() => useSceneStore.getState().tapTempo()}
        title="박자에 맞춰 반복 탭 → BPM 설정 (단축키 T)"
        style={{
          width: 52,
          height: 46,
          borderRadius: 6,
          background: anyRunning
            ? "linear-gradient(180deg, #3f7fd6, #1f4f9e)"
            : "linear-gradient(180deg, #4a4a52, #303036)",
          border: "1px solid #26262c",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
        }}
      >
        TAP
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#2a2a30", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(bpm)}
        </span>
        <span style={{ fontSize: 8, color: "#5a5a62", fontWeight: 700 }}>BPM</span>
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "8px 14px 12px" }}>
      {/* Playback Page -/+ (비활성, 실기기 재현) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ fontSize: 9, color: "#5a5a62", fontWeight: 600, marginBottom: 2 }}>Page</div>
        <button disabled style={pageBtnStyle} title="플레이백 페이지 (추후 개발)">
          −
        </button>
        <button disabled style={pageBtnStyle} title="플레이백 페이지 (추후 개발)">
          +
        </button>
      </div>

      {/* BO */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <div style={{ fontSize: 9, color: "#5a5a62" }}>&nbsp;</div>
        <button
          onClick={() => useSceneStore.getState().toggleBlackout()}
          title="블랙아웃 (B)"
          style={{
            width: 46,
            height: 46,
            borderRadius: 6,
            background: blackout
              ? "linear-gradient(180deg, #e0503f, #b8291b)"
              : "linear-gradient(180deg, #4a4a52, #303036)",
            border: blackout ? "2px solid #ff8578" : "1px solid #26262c",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: blackout
              ? "0 0 12px #ff6b5baa, inset 0 1px 0 rgba(255,255,255,0.3)"
              : "inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          BO
        </button>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#5a5a62" }}>Blackout</div>
      </div>

      {/* M (그랜드마스터) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <div style={{ fontSize: 9, color: "#5a5a62" }}>&nbsp;</div>
        <div style={{ height: 20 }} />
        <Fader
          label="grand-master"
          level={grandMaster}
          onChange={(v) => useSceneStore.getState().setGrandMaster(v)}
          onDoubleClick={() => useSceneStore.getState().setGrandMaster(1)}
          accent="#e0a030"
          height={FADER_H}
        />
        <div style={{ fontSize: 11, color: "#8a5a10", fontWeight: 800 }}>M</div>
        <div style={{ fontSize: 8.5, fontWeight: 600, color: "#5a5a62" }}>Grand</div>
      </div>

      {/* BPM / Tap Tempo (이펙트 속도 동기) */}
      <BpmControl />

      <div style={{ width: 2, alignSelf: "stretch", background: "#a0a0a6", margin: "0 4px", borderRadius: 2 }} />

      {/* 슬롯 1~10 */}
      <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "space-between" }}>
        {faderSlots.map((slot, i) => (
          <FaderSlotColumn key={i} index={i} slot={slot} legend={legendFor(slot, groups, looks)} />
        ))}
      </div>
    </div>
  );
}

const pageBtnStyle: React.CSSProperties = {
  width: 34,
  height: 20,
  borderRadius: 3,
  background: "linear-gradient(180deg, #e8e8ec, #cfcfd4)",
  border: "1px solid #a0a0a6",
  color: "#8a8a90",
  fontSize: 13,
  cursor: "not-allowed",
};
