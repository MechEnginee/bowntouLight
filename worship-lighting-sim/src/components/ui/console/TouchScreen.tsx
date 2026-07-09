// components/ui/console/TouchScreen.tsx
// 콘솔 상단 터치스크린 영역 — Groups 창 + Looks 창.
// 실기기 스크린 스타일: 짙은 남색 배경 + 파란 터치버튼 + 창 타이틀바.
//  - Groups: 클릭=선택(Ctrl=additive), 우클릭=메뉴(이름변경/멤버갱신/페이더할당/삭제)
//  - Looks: 클릭=즉시 적용(페이드), 더블클릭=이름변경, 우클릭=메뉴(이름변경/갱신/페이드시간/슬롯변경/삭제)

import { useState } from "react";
import { useSceneStore } from "../../../store/scene-store";
import type { FaderAssignment } from "../../../store/console-types";
import { ContextMenu, type MenuItem } from "./ContextMenu";

const SCREEN_BG = "#141b2e";
const WINDOW_BG = "#1a2438";
const BUTTON_BG = "#2c4a7c";
const BUTTON_ACTIVE = "#3f6bb0";
const TITLEBAR_BG = "#0f1524";

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
    if (editingId && draft.trim()) {
      useSceneStore.getState().renameGroup(editingId, draft.trim());
    }
    setEditingId(null);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div
        style={{
          background: TITLEBAR_BG,
          color: "#9ab8e0",
          fontSize: 11,
          fontWeight: 700,
          padding: "4px 8px",
          borderBottom: "1px solid #2a3550",
        }}
      >
        GROUPS
      </div>
      <div
        style={{
          flex: 1,
          background: WINDOW_BG,
          padding: 6,
          display: "flex",
          flexWrap: "wrap",
          alignContent: "flex-start",
          gap: 6,
          overflowY: "auto",
        }}
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
                minWidth: 68,
                padding: "8px 10px",
                borderRadius: 4,
                border: active ? "2px solid #7ec4ff" : "1px solid #3a5a8c",
                background: active ? BUTTON_ACTIVE : BUTTON_BG,
                color: "#fff",
                fontSize: 12,
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
                  style={{
                    width: 60,
                    background: "#0a0a14",
                    border: "1px solid #7ec4ff",
                    borderRadius: 3,
                    color: "#fff",
                    fontSize: 12,
                    padding: "1px 3px",
                  }}
                />
              ) : (
                <>
                  {g.name}
                  <div style={{ fontSize: 9, opacity: 0.7, fontWeight: 400 }}>
                    {g.fixtureIds.length}대
                  </div>
                </>
              )}
            </button>
          );
        })}
        <button
          onClick={() => useSceneStore.getState().createGroup()}
          disabled={selectedIds.length === 0}
          title={selectedIds.length === 0 ? "픽스처를 먼저 선택하세요" : "현재 선택으로 그룹 생성"}
          style={{
            minWidth: 56,
            padding: "8px 10px",
            borderRadius: 4,
            border: "1px dashed #4a6a9c",
            background: "transparent",
            color: selectedIds.length === 0 ? "#4a5a75" : "#9ab8e0",
            fontSize: 18,
            cursor: selectedIds.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          +
        </button>
      </div>

      {menu &&
        (() => {
          const g = groups.find((x) => x.id === menu.groupId);
          if (!g) return null;
          const items: MenuItem[] = [
            {
              label: "이름변경",
              onSelect: () => {
                setEditingId(g.id);
                setDraft(g.name);
              },
            },
            {
              label: "멤버를 현재 선택으로 갱신",
              onSelect: () => useSceneStore.getState().updateGroupMembers(g.id),
            },
            {
              label: "페이더에 할당 (그룹 마스터)",
              onSelect: () => {
                const idx = findEmptySlot(faderSlots);
                if (idx < 0) {
                  alert("빈 페이더 슬롯이 없습니다.");
                  return;
                }
                useSceneStore.getState().assignFader(idx, { kind: "groupMaster", groupId: g.id });
              },
            },
            { label: "삭제", danger: true, onSelect: () => useSceneStore.getState().deleteGroup(g.id) },
          ];
          return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />;
        })()}
    </div>
  );
}

function LooksWindow() {
  const looks = useSceneStore((s) => s.looks);
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const faderSlots = useSceneStore((s) => s.faderSlots);
  const [menu, setMenu] = useState<{ x: number; y: number; lookId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const commitRename = () => {
    if (editingId && draft.trim()) {
      useSceneStore.getState().renameLook(editingId, draft.trim());
    }
    setEditingId(null);
  };

  const swatchColor = (values: Record<string, { color?: string }>): string | null => {
    for (const v of Object.values(values)) {
      if (v.color) return v.color;
    }
    return null;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div
        style={{
          background: TITLEBAR_BG,
          color: "#9ab8e0",
          fontSize: 11,
          fontWeight: 700,
          padding: "4px 8px",
          borderBottom: "1px solid #2a3550",
        }}
      >
        LOOKS
      </div>
      <div
        style={{
          flex: 1,
          background: WINDOW_BG,
          padding: 6,
          display: "flex",
          flexWrap: "wrap",
          alignContent: "flex-start",
          gap: 6,
          overflowY: "auto",
        }}
      >
        {looks.map((l) => {
          const sw = swatchColor(l.values);
          return (
            <button
              key={l.id}
              onClick={() => useSceneStore.getState().applyLook(l.id)}
              onDoubleClick={() => {
                setEditingId(l.id);
                setDraft(l.name);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, lookId: l.id });
              }}
              title={`${Object.keys(l.values).length}개 픽스처 · ${l.fadeMs}ms 페이드`}
              style={{
                minWidth: 72,
                padding: "8px 10px",
                borderRadius: 4,
                border: "1px solid #3a5a8c",
                background: BUTTON_BG,
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
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
                  style={{
                    width: 56,
                    background: "#0a0a14",
                    border: "1px solid #7ec4ff",
                    borderRadius: 3,
                    color: "#fff",
                    fontSize: 12,
                    padding: "1px 3px",
                  }}
                />
              ) : (
                <span>{l.name}</span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => useSceneStore.getState().saveLook()}
          disabled={selectedIds.length === 0}
          title={selectedIds.length === 0 ? "픽스처를 먼저 선택하세요" : "현재 상태를 룩으로 저장"}
          style={{
            minWidth: 56,
            padding: "8px 10px",
            borderRadius: 4,
            border: "1px dashed #4a6a9c",
            background: "transparent",
            color: selectedIds.length === 0 ? "#4a5a75" : "#9ab8e0",
            fontSize: 18,
            cursor: selectedIds.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          +
        </button>
      </div>

      {menu &&
        (() => {
          const l = looks.find((x) => x.id === menu.lookId);
          if (!l) return null;
          const items: MenuItem[] = [
            {
              label: "이름변경",
              onSelect: () => {
                setEditingId(l.id);
                setDraft(l.name);
              },
            },
            {
              label: "현재 상태로 갱신",
              onSelect: () => useSceneStore.getState().updateLook(l.id),
            },
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
                  const idx = faderSlots.findIndex(
                    (sl) => sl.assignment?.kind === "look" && sl.assignment.lookId === l.id,
                  );
                  if (idx >= 0) useSceneStore.getState().assignFader(idx, null);
                },
              ),
            },
            { label: "삭제", danger: true, onSelect: () => useSceneStore.getState().deleteLook(l.id) },
          ];
          return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />;
        })()}
    </div>
  );
}

export function TouchScreen() {
  return (
    <div
      style={{
        display: "flex",
        gap: 1,
        background: SCREEN_BG,
        border: "2px solid #0a0a0a",
        borderRadius: 4,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <GroupsWindow />
      <div style={{ width: 1, background: "#2a3550" }} />
      <LooksWindow />
    </div>
  );
}
