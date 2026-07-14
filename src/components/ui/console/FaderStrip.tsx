// components/ui/console/FaderStrip.tsx
// 콘솔 하단 물리 페이더 스트립 — Tiger Touch II 실기기 하단부 재현.
// 밝은 회색 바디 + 흰색 캡 페이더 + 파란 Flash LED 버튼.
// 좌측: Playback Page -/+ · BO · M(그랜드마스터). 우측: 슬롯 10개(Flash + 페이더 + legend).

import { useState } from "react";
import { useSceneStore } from "../../../store/scene-store";
import type { FaderSlot } from "../../../store/console-types";
import { FADERS_PER_PAGE } from "../../../store/console-types";
import { Fader } from "./Fader";

// 페이더 높이는 CSS flex로 자동 스케일한다(측정 불필요) — 컬럼을 채우고 남는 세로 공간을
// Fader가 flex:1로 가져간다. 창/콘솔이 작아지면 페이더도 함께 줄어든다.

function legendFor(
  slot: FaderSlot,
  groups: { id: string; name: string }[],
  looks: { id: string; name: string; values: Record<string, { color?: string }>; effects?: unknown[] }[],
  effects: { id: string; name: string }[],
): { text: string; color?: string } | null {
  const a = slot.assignment;
  if (!a) return null;
  if (a.kind === "look") {
    const l = looks.find((x) => x.id === a.lookId);
    if (!l) return null;
    const sw = Object.values(l.values).find((v) => v.color)?.color;
    // ✦ = 셰이프 포함 큐. accent 색은 look 파랑 유지(보라는 셰이프 전용 큐 고유색)
    const text = l.effects?.length ? `✦ ${l.name}` : l.name;
    return { text, color: sw };
  }
  if (a.kind === "effect") {
    const e = effects.find((x) => x.id === a.effectId);
    return e ? { text: `✦ ${e.name}` } : null;
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
  displayNum,
  slot,
  legend,
}: {
  index: number;
  displayNum: number;
  slot: FaderSlot;
  legend: { text: string; color?: string } | null;
}) {
  const assigned = !!slot.assignment;
  const kind = slot.assignment?.kind;
  const accent = !assigned ? "#9a9aa2" : kind === "look" ? "#2f7fe0" : kind === "effect" ? "#a45cff" : "#3fae5a";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 44, height: "100%", minHeight: 0 }}
    >
      <FlashButton index={index} slot={slot} assigned={assigned} />
      <Fader
        label={`slot-${index + 1}`}
        level={slot.level}
        onChange={(v) => useSceneStore.getState().setFaderLevel(index, v)}
        onDoubleClick={() => assigned && useSceneStore.getState().setFaderLevel(index, 1)}
        disabled={!assigned}
        accent={accent}
      />
      {/* 슬롯 번호 (실기기 프린트 — 페이지 내 1..10) */}
      <div style={{ fontSize: 9, fontWeight: 700, color: "#4a4a52" }}>{displayNum}</div>
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n)) useSceneStore.getState().setBpm(n);
    setEditing(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
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
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            style={{
              width: 38,
              background: "#fff",
              border: "1px solid #4aa0ff",
              borderRadius: 3,
              color: "#111",
              fontSize: 12,
              fontWeight: 800,
              textAlign: "right",
              padding: "0 2px",
            }}
          />
        ) : (
          <span
            onDoubleClick={() => {
              setDraft(String(Math.round(bpm)));
              setEditing(true);
            }}
            title="더블클릭=BPM 직접 입력"
            style={{ fontSize: 13, fontWeight: 800, color: "#2a2a30", fontVariantNumeric: "tabular-nums", cursor: "text" }}
          >
            {Math.round(bpm)}
          </span>
        )}
        <span style={{ fontSize: 8, color: "#5a5a62", fontWeight: 700 }}>BPM</span>
      </div>
    </div>
  );
}

export function FaderStrip() {
  const faderSlots = useSceneStore((s) => s.faderSlots);
  const faderPage = useSceneStore((s) => s.faderPage);
  const grandMaster = useSceneStore((s) => s.grandMaster);
  const blackout = useSceneStore((s) => s.blackout);
  const groups = useSceneStore((s) => s.groups);
  const looks = useSceneStore((s) => s.looks);
  const effects = useSceneStore((s) => s.effects);

  const pageCount = Math.max(1, faderSlots.length / FADERS_PER_PAGE);
  const page = Math.min(faderPage, pageCount - 1);
  const base = page * FADERS_PER_PAGE;
  const pageSlots = faderSlots.slice(base, base + FADERS_PER_PAGE);
  // 마지막 페이지가 비어 있고 2페이지 이상이면 삭제 가능
  const lastPageEmpty = pageCount > 1 && faderSlots.slice((pageCount - 1) * FADERS_PER_PAGE).every((sl) => !sl.assignment);

  return (
    <div
      style={{ display: "flex", alignItems: "stretch", gap: 12, padding: "8px 14px 12px", height: "100%", boxSizing: "border-box", minHeight: 0 }}
    >
      {/* Playback Page 관리 — 페이지 전환/추가/삭제 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
        <div style={{ fontSize: 9, color: "#5a5a62", fontWeight: 600 }}>Page</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#2a2a30", fontVariantNumeric: "tabular-nums" }}>
          {page + 1} / {pageCount}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <button
            onClick={() => useSceneStore.getState().setFaderPage(page - 1)}
            disabled={page <= 0}
            style={pageBtnStyle(page <= 0)}
            title="이전 페이지"
          >
            ◀
          </button>
          <button
            onClick={() => useSceneStore.getState().setFaderPage(page + 1)}
            disabled={page >= pageCount - 1}
            style={pageBtnStyle(page >= pageCount - 1)}
            title="다음 페이지"
          >
            ▶
          </button>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <button
            onClick={() => useSceneStore.getState().addFaderPage()}
            style={pageBtnStyle(false)}
            title="페이지 추가 (빈 페이더 10칸)"
          >
            ＋
          </button>
          <button
            onClick={() => useSceneStore.getState().removeFaderPage()}
            disabled={!lastPageEmpty}
            style={pageBtnStyle(!lastPageEmpty)}
            title={
              pageCount <= 1
                ? "페이지가 하나뿐입니다"
                : lastPageEmpty
                  ? "마지막(빈) 페이지 삭제"
                  : "마지막 페이지가 사용 중이라 삭제할 수 없습니다"
            }
          >
            🗑
          </button>
        </div>
      </div>

      {/* BO */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%", minHeight: 0 }}>
        <div style={{ fontSize: 9, color: "#5a5a62", flex: "0 0 auto" }}>&nbsp;</div>
        <div style={{ height: 20, flex: "0 0 auto" }} />
        <Fader
          label="grand-master"
          level={grandMaster}
          onChange={(v) => useSceneStore.getState().setGrandMaster(v)}
          onDoubleClick={() => useSceneStore.getState().setGrandMaster(1)}
          accent="#e0a030"
        />
        <div style={{ fontSize: 11, color: "#8a5a10", fontWeight: 800, flex: "0 0 auto" }}>M</div>
        <div style={{ fontSize: 8.5, fontWeight: 600, color: "#5a5a62", flex: "0 0 auto" }}>Grand</div>
      </div>

      {/* BPM / Tap Tempo (이펙트 속도 동기) */}
      <BpmControl />

      <div style={{ width: 2, alignSelf: "stretch", background: "#a0a0a6", margin: "0 4px", borderRadius: 2 }} />

      {/* 현재 페이지의 슬롯 1~10 (전역 인덱스 = base+i) */}
      <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "space-between", alignItems: "stretch", minHeight: 0 }}>
        {pageSlots.map((slot, i) => (
          <FaderSlotColumn
            key={base + i}
            index={base + i}
            displayNum={i + 1}
            slot={slot}
            legend={legendFor(slot, groups, looks, effects)}
          />
        ))}
      </div>
    </div>
  );
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 20,
    borderRadius: 3,
    background: disabled
      ? "linear-gradient(180deg, #dcdce0, #c6c6cc)"
      : "linear-gradient(180deg, #f0f0f4, #d6d6dc)",
    border: "1px solid #a0a0a6",
    color: disabled ? "#a8a8ae" : "#3a3a42",
    fontSize: 11,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: 0,
  };
}
