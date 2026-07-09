// components/ui/console/TouchScreen.tsx
// 콘솔 상단 터치스크린 — Avolites Tiger Touch II 실기기 스크린 레이아웃 전체 재현.
// 실기기 화면 구성을 그대로 옮기고, 이 앱에 기능이 있는 창은 실제로 동작하게 매핑한다.
//
//  ┌ 좌측 스택 ─────┐┌ 중앙 스택 ─┐┌ Playbacks ─┐┌ 우측 메뉴 ┐
//  │ Fixtures       ││ Groups     ││ (룩 그리드) ││ Program   │
//  │ Colours        ││ Gobos/Beams││            ││ Workspaces│
//  └────────────────┘└────────────┘└────────────┘│ IPCGBESFX │
//
//  기능 매핑:
//   - Fixtures      → 픽스처 셀 클릭 = 선택 (실동작)
//   - Colours       → 색 스와치 클릭 = 선택 픽스처에 색 적용 (실동작)
//   - Gobos/Beams   → 밝기 % 팔레트 클릭 = 선택 픽스처에 dimmer 적용 (실동작)
//   - Groups        → 그룹 생성/선택/할당 (실동작)
//   - Playbacks     → 룩 저장/적용/페이더 할당 (실동작)
//   - 우측 Program Menu / Workspaces / I P C G B E S FX 탭 → 실기기 외형 재현(비활성 장식)

import { useState } from "react";
import { useSceneStore } from "../../../store/scene-store";
import type { FixtureType } from "../../../config/fixtures.config";
import type { FaderAssignment } from "../../../store/console-types";
import { ContextMenu, type MenuItem } from "./ContextMenu";

const SCREEN_BG = "#0d1322";
const WINDOW_BODY = "#141d30";
const BUTTON_BG = "#2c4a7c";
const BUTTON_ACTIVE = "#3f6bb0";
const TITLEBAR_BG = "#0f1524";
const TITLEBAR_FG = "#9ab8e0";

function findEmptySlot(faderSlots: { assignment: FaderAssignment | null }[]): number {
  return faderSlots.findIndex((s) => s.assignment === null);
}

function slotSubmenu(
  faderSlots: { assignment: FaderAssignment | null }[],
  onPick: (slotIndex: number) => void,
  onClear?: () => void,
): { label: string; onSelect: () => void }[] {
  const items = faderSlots.map((sl, i) => ({
    label: `슬롯 ${i + 1}${sl.assignment ? " (사용중)" : ""}`,
    onSelect: () => onPick(i),
  }));
  if (onClear) items.push({ label: "해제", onSelect: onClear });
  return items;
}

// ─────────────────────────────────────────────────────────────────────────
// 재사용 창 크롬 (실기기 창 타이틀바 + ⚙ 📷 ✕ 아이콘 재현)
// ─────────────────────────────────────────────────────────────────────────
function ScreenWindow({
  title,
  flex,
  children,
  bodyStyle,
}: {
  title: string;
  flex?: number | string;
  children: React.ReactNode;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <div style={{ flex: flex ?? 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
      <div
        style={{
          background: TITLEBAR_BG,
          color: TITLEBAR_FG,
          fontSize: 11,
          fontWeight: 700,
          padding: "3px 6px",
          borderBottom: "1px solid #2a3550",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
        <span style={{ display: "flex", gap: 4, opacity: 0.45, fontSize: 9, fontWeight: 400 }}>
          <span>⚙</span>
          <span>▣</span>
          <span>✕</span>
        </span>
      </div>
      <div
        style={{
          flex: 1,
          background: WINDOW_BODY,
          padding: 5,
          overflowY: "auto",
          minHeight: 0,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Fixtures 창 — 픽스처 셀(클릭=선택). 실기기 Fixtures 창 스타일.
// ─────────────────────────────────────────────────────────────────────────
const TYPE_SHORT: Partial<Record<FixtureType, string>> = {
  movingHead: "MOVING",
  par: "MINI BEAM",
  strobe: "STROBE",
  hazer: "HAZER",
  light: "LIGHT",
  bar: "TRUSS",
  wall: "WALL",
  floor: "FLOOR",
};
const FIXTURE_TYPE_ORDER: FixtureType[] = ["movingHead", "par", "strobe", "hazer", "light"];

function FixturesWindow() {
  const fixtures = useSceneStore((s) => s.fixtures);
  const order = useSceneStore((s) => s.order);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const selectedSet = new Set(selectedIds);

  const ids = order.filter((id) => FIXTURE_TYPE_ORDER.includes(fixtures[id].type));

  const onCellClick = (id: string, e: React.MouseEvent) => {
    const s = useSceneStore.getState();
    if (e.ctrlKey || e.metaKey) s.toggleSelect(id);
    else if (e.shiftKey) s.rangeSelect(id, ids); // 이 창에 보이는 순서로 범위 계산
    else s.selectSingle(id);
  };

  return (
    <ScreenWindow
      title="Fixtures"
      flex={1.4}
      bodyStyle={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 3 }}
    >
      {ids.map((id) => {
        const f = fixtures[id];
        const sel = selectedSet.has(id);
        return (
          <button
            key={id}
            onClick={(e) => onCellClick(id, e)}
            title={f.name}
            style={{
              width: 52,
              height: 40,
              borderRadius: 3,
              border: sel ? "2px solid #7ec4ff" : "1px solid #33507e",
              background: sel ? BUTTON_ACTIVE : BUTTON_BG,
              color: "#dce8f8",
              fontSize: 8.5,
              lineHeight: 1.15,
              cursor: "pointer",
              padding: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              overflow: "hidden",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 8 }}>{f.name}</span>
            <span style={{ opacity: 0.7 }}>{TYPE_SHORT[f.type] ?? f.type}</span>
          </button>
        );
      })}
      {ids.length === 0 && (
        <div style={{ color: "#5a6a88", fontSize: 10, padding: 6 }}>픽스처가 없습니다</div>
      )}
    </ScreenWindow>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Colours 창 — 색 팔레트(클릭=선택 픽스처에 색 적용). 실기기 Colours 창 재현.
// ─────────────────────────────────────────────────────────────────────────
const COLOUR_PALETTE: { name: string; hex: string }[] = [
  { name: "Red", hex: "#ff2a2a" },
  { name: "Orange", hex: "#ff7a1a" },
  { name: "Amber", hex: "#ffb000" },
  { name: "Yellow", hex: "#ffe100" },
  { name: "Green", hex: "#2ecc40" },
  { name: "Spring", hex: "#6ee06e" },
  { name: "Cyan", hex: "#25d0d0" },
  { name: "Sky", hex: "#3aa0ff" },
  { name: "Blue", hex: "#1e5cff" },
  { name: "Indigo", hex: "#5b3af0" },
  { name: "Magenta", hex: "#e030d0" },
  { name: "Pink", hex: "#ff6ec7" },
  { name: "Lavender", hex: "#b58cff" },
  { name: "Warm", hex: "#ffd9a0" },
  { name: "CTO", hex: "#ffc27a" },
  { name: "White", hex: "#ffffff" },
];

function ColoursWindow() {
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const apply = (hex: string) => {
    const s = useSceneStore.getState();
    if (s.selectedIds.length === 0) return;
    s.update(s.selectedIds, { color: hex, on: true });
  };
  const disabled = selectedIds.length === 0;
  return (
    <ScreenWindow
      title="Colours"
      bodyStyle={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 3 }}
    >
      {COLOUR_PALETTE.map((c, i) => (
        <button
          key={c.name}
          onClick={() => apply(c.hex)}
          disabled={disabled}
          title={disabled ? "픽스처를 먼저 선택하세요" : `${c.name} 적용`}
          style={{
            width: 34,
            height: 30,
            borderRadius: 3,
            border: "1px solid rgba(0,0,0,0.5)",
            background: c.hex,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            fontSize: 7.5,
            color: i >= 13 ? "#333" : "#fff",
            textShadow: i >= 13 ? "none" : "0 1px 1px rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 1,
          }}
        >
          {c.name}
        </button>
      ))}
    </ScreenWindow>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Gobos and Beams 창 — 밝기 % 팔레트(클릭=선택 픽스처에 dimmer 적용).
// 실기기의 "Generic 79% / 85% / 100%" 세대(Beam) 팔레트 재현.
// ─────────────────────────────────────────────────────────────────────────
const DIMMER_PRESETS = [0, 10, 25, 50, 75, 85, 100];

function BeamsWindow() {
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const disabled = selectedIds.length === 0;
  const apply = (pct: number) => {
    const s = useSceneStore.getState();
    if (s.selectedIds.length === 0) return;
    s.update(s.selectedIds, { dimmer: pct / 100, on: pct > 0 });
  };
  return (
    <ScreenWindow
      title="Gobos and Beams"
      bodyStyle={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 3 }}
    >
      {DIMMER_PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => apply(p)}
          disabled={disabled}
          title={disabled ? "픽스처를 먼저 선택하세요" : `밝기 ${p}%`}
          style={{
            width: 48,
            height: 34,
            borderRadius: 3,
            border: "1px solid #33507e",
            background: BUTTON_BG,
            color: "#dce8f8",
            fontSize: 9,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1.2,
          }}
        >
          <span style={{ opacity: 0.6, fontSize: 7.5 }}>Generic</span>
          <span style={{ fontWeight: 700 }}>{p}%</span>
        </button>
      ))}
    </ScreenWindow>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Groups 창 — 그룹 생성/선택/이름변경/멤버갱신/페이더 할당/삭제.
// ─────────────────────────────────────────────────────────────────────────
function GroupsWindow() {
  const groups = useSceneStore((s) => s.groups);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const faderSlots = useSceneStore((s) => s.faderSlots);
  const [menu, setMenu] = useState<{ x: number; y: number; groupId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const selectedSet = new Set(selectedIds);
  const isExactSelection = (fixtureIds: string[]) =>
    fixtureIds.length > 0 &&
    fixtureIds.length === selectedIds.length &&
    fixtureIds.every((id) => selectedSet.has(id));

  const commitRename = () => {
    if (editingId && draft.trim()) useSceneStore.getState().renameGroup(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <ScreenWindow
      title="Groups"
      bodyStyle={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 4 }}
    >
      {groups.map((g) => {
        const active = isExactSelection(g.fixtureIds);
        return (
          <button
            key={g.id}
            onClick={(e) => useSceneStore.getState().selectGroup(g.id, e.ctrlKey || e.metaKey)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, groupId: g.id });
            }}
            title={`${g.fixtureIds.length}개 픽스처`}
            style={{
              minWidth: 58,
              padding: "6px 8px",
              borderRadius: 4,
              border: active ? "2px solid #7ec4ff" : "1px solid #3a5a8c",
              background: active ? BUTTON_ACTIVE : BUTTON_BG,
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {editingId === g.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                style={inlineInputStyle}
              />
            ) : (
              <>
                {g.name}
                <div style={{ fontSize: 8.5, opacity: 0.7, fontWeight: 400 }}>{g.fixtureIds.length}대</div>
              </>
            )}
          </button>
        );
      })}
      <button
        onClick={() => useSceneStore.getState().createGroup()}
        disabled={selectedIds.length === 0}
        title={selectedIds.length === 0 ? "픽스처를 먼저 선택하세요" : "현재 선택으로 그룹 생성"}
        style={addBtnStyle(selectedIds.length === 0)}
      >
        +
      </button>

      {menu &&
        (() => {
          const g = groups.find((x) => x.id === menu.groupId);
          if (!g) return null;
          const items: MenuItem[] = [
            { label: "이름변경", onSelect: () => { setEditingId(g.id); setDraft(g.name); } },
            { label: "멤버를 현재 선택으로 갱신", onSelect: () => useSceneStore.getState().updateGroupMembers(g.id) },
            {
              label: "페이더에 할당 (그룹 마스터)",
              onSelect: () => {
                const idx = findEmptySlot(faderSlots);
                if (idx < 0) { alert("빈 페이더 슬롯이 없습니다."); return; }
                useSceneStore.getState().assignFader(idx, { kind: "groupMaster", groupId: g.id });
              },
            },
            { label: "삭제", danger: true, onSelect: () => useSceneStore.getState().deleteGroup(g.id) },
          ];
          return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />;
        })()}
    </ScreenWindow>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Playbacks 창 — 룩(Look) 그리드. 실기기 Playbacks 창(페이더에 올라가는 것) 재현.
// 클릭=적용, 더블클릭=이름편집, 우클릭=메뉴, +=현재 상태 저장.
// ─────────────────────────────────────────────────────────────────────────
function PlaybacksWindow() {
  const looks = useSceneStore((s) => s.looks);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const faderSlots = useSceneStore((s) => s.faderSlots);
  const [menu, setMenu] = useState<{ x: number; y: number; lookId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const commitRename = () => {
    if (editingId && draft.trim()) useSceneStore.getState().renameLook(editingId, draft.trim());
    setEditingId(null);
  };
  const swatchColor = (values: Record<string, { color?: string }>): string | null => {
    for (const v of Object.values(values)) if (v.color) return v.color;
    return null;
  };
  const slotOfLook = (lookId: string) =>
    faderSlots.findIndex((sl) => sl.assignment?.kind === "look" && sl.assignment.lookId === lookId);

  return (
    <ScreenWindow
      title="Playbacks"
      flex={1.4}
      bodyStyle={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 4 }}
    >
      {looks.map((l) => {
        const sw = swatchColor(l.values);
        const slot = slotOfLook(l.id);
        return (
          <button
            key={l.id}
            onClick={() => useSceneStore.getState().applyLook(l.id)}
            onDoubleClick={() => { setEditingId(l.id); setDraft(l.name); }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, lookId: l.id });
            }}
            title={`${Object.keys(l.values).length}개 픽스처 · ${l.fadeMs}ms 페이드`}
            style={{
              width: 74,
              minHeight: 46,
              padding: "5px 6px",
              borderRadius: 4,
              border: "1px solid #3a5a8c",
              background: BUTTON_BG,
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {sw && (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: sw,
                    border: "1px solid rgba(255,255,255,0.4)",
                    flex: "0 0 auto",
                  }}
                />
              )}
              {editingId === l.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  style={inlineInputStyle}
                />
              ) : (
                <span style={{ wordBreak: "keep-all" }}>{l.name}</span>
              )}
            </div>
            {slot >= 0 && (
              <span style={{ fontSize: 8, color: "#9ec8ff", opacity: 0.9 }}>▸ 페이더 {slot + 1}</span>
            )}
          </button>
        );
      })}
      <button
        onClick={() => useSceneStore.getState().saveLook()}
        disabled={selectedIds.length === 0}
        title={selectedIds.length === 0 ? "픽스처를 먼저 선택하세요" : "현재 상태를 룩으로 저장"}
        style={{ ...addBtnStyle(selectedIds.length === 0), width: 74, minHeight: 46 }}
      >
        +
      </button>

      {menu &&
        (() => {
          const l = looks.find((x) => x.id === menu.lookId);
          if (!l) return null;
          const items: MenuItem[] = [
            { label: "이름변경", onSelect: () => { setEditingId(l.id); setDraft(l.name); } },
            { label: "현재 상태로 갱신", onSelect: () => useSceneStore.getState().updateLook(l.id) },
            {
              label: `페이드 시간 (현재 ${l.fadeMs}ms)`,
              onSelect: () => {
                const v = window.prompt("페이드 시간(ms)을 입력하세요", String(l.fadeMs));
                if (v === null) return;
                const ms = parseFloat(v);
                if (Number.isFinite(ms)) useSceneStore.getState().setLookFade(l.id, ms);
              },
            },
            {
              label: "페이더 슬롯 변경",
              submenu: slotSubmenu(
                faderSlots,
                (idx) => useSceneStore.getState().assignFader(idx, { kind: "look", lookId: l.id }),
                () => {
                  const idx = slotOfLook(l.id);
                  if (idx >= 0) useSceneStore.getState().assignFader(idx, null);
                },
              ),
            },
            { label: "삭제", danger: true, onSelect: () => useSceneStore.getState().deleteLook(l.id) },
          ];
          return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />;
        })()}
    </ScreenWindow>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 우측 메뉴 칼럼 — 실기기 Program Menu + Workspaces + I P C G B E S FX 탭 재현(장식).
// ─────────────────────────────────────────────────────────────────────────
const PROGRAM_MENU = [
  "Edit Times",
  "Playback Options",
  "Set Legend",
  "Shapes And Effects",
  "Timecode",
  "Open Workspace Window",
  "Wheels = Level",
];
const WORKSPACES = [
  "Groups and Palettes",
  "Fixtures and Groups",
  "Attribute Editor",
  "Effect Editor",
  "Workspace 5",
  "Workspace 6",
];
const ATTR_TABS = ["I", "P", "C", "G", "B", "E", "S", "FX"];

function MenuColumn() {
  return (
    <div
      style={{
        width: 150,
        flex: "0 0 150px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "2px 4px",
        borderLeft: "1px solid #223049",
      }}
    >
      <div style={{ fontSize: 9, color: "#8fadd8", lineHeight: 1.6 }}>
        User · Operator · Profile · Program
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {PROGRAM_MENU.map((m) => (
          <div key={m} style={menuBtnStyle} title="실기기 외형 재현(비활성)">
            {m}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: "#8fadd8", marginTop: 2 }}>Workspaces</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {WORKSPACES.map((w, i) => (
          <div key={w} style={{ ...wsBtnStyle }} title="실기기 외형 재현(비활성)">
            <span style={{ opacity: 0.55, fontSize: 8 }}>{i + 1}</span> {w}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 2, justifyContent: "space-between" }}>
        {ATTR_TABS.map((t, i) => (
          <div
            key={t}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 9,
              fontWeight: 700,
              color: i === 0 ? "#fff" : "#7f9ac4",
              background: i === 0 ? BUTTON_BG : "transparent",
              border: "1px solid #2a3a58",
              borderRadius: 2,
              padding: "2px 0",
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
export function TouchScreen() {
  return (
    <div
      style={{
        display: "flex",
        gap: 5,
        background: SCREEN_BG,
        border: "2px solid #050810",
        borderRadius: 4,
        height: "100%",
        overflow: "hidden",
        padding: 5,
      }}
    >
      {/* 좌측 스택: Fixtures + Colours */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        <FixturesWindow />
        <ColoursWindow />
      </div>

      {/* 중앙 스택: Groups + Gobos/Beams */}
      <div style={{ flex: 0.85, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        <GroupsWindow />
        <BeamsWindow />
      </div>

      {/* Playbacks(룩) */}
      <div style={{ flex: 1.3, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <PlaybacksWindow />
      </div>

      {/* 우측 메뉴 칼럼(장식) */}
      <MenuColumn />
    </div>
  );
}

// ── 공유 스타일 ──────────────────────────────────────────────────────────
const inlineInputStyle: React.CSSProperties = {
  width: 56,
  background: "#0a0a14",
  border: "1px solid #7ec4ff",
  borderRadius: 3,
  color: "#fff",
  fontSize: 11,
  padding: "1px 3px",
};

const menuBtnStyle: React.CSSProperties = {
  fontSize: 9.5,
  color: "#c3d3ee",
  background: "linear-gradient(180deg, #26314a, #1b2338)",
  border: "1px solid #33425f",
  borderRadius: 3,
  padding: "4px 6px",
  cursor: "default",
};

const wsBtnStyle: React.CSSProperties = {
  fontSize: 8.5,
  color: "#c3d3ee",
  background: "#1b2338",
  border: "1px solid #33425f",
  borderRadius: 3,
  padding: "4px 5px",
  width: "100%",
  cursor: "default",
};

function addBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    minWidth: 44,
    padding: "6px 8px",
    borderRadius: 4,
    border: "1px dashed #4a6a9c",
    background: "transparent",
    color: disabled ? "#4a5a75" : "#9ab8e0",
    fontSize: 18,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
