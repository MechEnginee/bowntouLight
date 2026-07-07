// components/ui/FixtureList.tsx — 좌측 패널
// 클릭: 단일 선택 / Ctrl+클릭: 토글 / Shift+클릭: 범위 선택 (Windows 탐색기 UX)
// 항목을 캔버스로 드래그&드롭하면 그 픽스처를 해당 지점으로 이동.

import { useSceneStore } from "../../store/scene-store";
import type { FixtureType } from "../../config/fixtures.config";

const GROUP_LABEL: Record<FixtureType, string> = {
  movingHead: "무빙 워시 (LED Wash Moving)",
  par: "미니빔 (LED Mini Beam 251)",
  strobe: "스트로브 (LED Strobe)",
  hazer: "헤이저",
  wall: "반사 벽 (Wall)",
  floor: "반사 바닥 (Floor)",
};

const TYPE_ORDER: FixtureType[] = [
  "movingHead",
  "par",
  "strobe",
  "hazer",
  "wall",
  "floor",
];

/** 목록에서 바로 새 오브젝트를 추가할 수 있는 타입 */
const ADDABLE: FixtureType[] = ["wall", "floor"];

export function FixtureList() {
  const fixtures = useSceneStore((s) => s.fixtures);
  const order = useSceneStore((s) => s.order);
  const selectedIds = useSceneStore((s) => s.selectedIds);

  const idsByType = (t: FixtureType) =>
    order.filter((id) => fixtures[id].type === t);

  const handleClick = (id: string, e: React.MouseEvent) => {
    const s = useSceneStore.getState();
    if (e.shiftKey) s.rangeSelect(id);
    else if (e.ctrlKey || e.metaKey) s.toggleSelect(id);
    else s.selectSingle(id);
  };

  return (
    <aside
      style={{
        width: 260,
        flex: "0 0 260px",
        height: "100%",
        background: "#1a1a2e",
        color: "#E0E0E0",
        borderRight: "1px solid #2a2a40",
        overflowY: "auto",
        padding: "12px 10px",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#4A90D9" }}>
        픽스처 목록{selectedIds.length > 0 && ` · ${selectedIds.length}개 선택`}
      </div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>
        클릭=선택 · Ctrl+클릭=토글 · Shift+클릭=범위
        <br />
        항목을 캔버스로 드래그하면 위치 이동
      </div>

      {TYPE_ORDER.map((t) => {
        const ids = idsByType(t);
        const addable = ADDABLE.includes(t);
        if (ids.length === 0 && !addable) return null;
        return (
          <div key={t} style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#7a7a9a",
                marginBottom: 6,
              }}
            >
              <span>{GROUP_LABEL[t]}</span>
              {addable && (
                <button
                  onClick={() => useSceneStore.getState().addObject(t)}
                  title={`${GROUP_LABEL[t]} 추가`}
                  style={{
                    border: "1px solid #3a3a55",
                    background: "#22223a",
                    color: "#9ab8e0",
                    borderRadius: 4,
                    fontSize: 11,
                    lineHeight: 1,
                    padding: "3px 7px",
                    cursor: "pointer",
                  }}
                >
                  + 추가
                </button>
              )}
            </div>
            {ids.map((id) => {
              const f = fixtures[id];
              const isSel = selectedIds.includes(id);
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", id);
                    e.dataTransfer.effectAllowed = "move";
                    // 선택돼 있지 않은 항목을 끌면 그 항목을 단일 선택
                    if (!useSceneStore.getState().selectedIds.includes(id)) {
                      useSceneStore.getState().selectSingle(id);
                    }
                  }}
                  onClick={(e) => handleClick(id, e)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    marginBottom: 3,
                    borderRadius: 5,
                    cursor: "grab",
                    fontSize: 13,
                    background: isSel ? "#4A90D9" : "#22223a",
                    color: isSel ? "#fff" : "#d0d0d8",
                    border: isSel ? "1px solid #7bb3e8" : "1px solid transparent",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: f.on ? "#FF6B35" : "#555",
                      boxShadow: f.on ? "0 0 6px #FF6B35" : "none",
                      flex: "0 0 auto",
                    }}
                  />
                  <span style={{ flex: 1 }}>{id}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
