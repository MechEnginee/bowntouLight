// store/scene-store.ts
// 픽스처 런타임 상태 + 다중 선택(Windows 탐색기 UX) 단일 진실 소스.
//  - selectSingle : 단일 선택(앵커 갱신)
//  - toggleSelect : Ctrl+클릭 (개별 토글)
//  - rangeSelect  : Shift+클릭 (앵커~대상 범위, order 기준)
//  - setSelection : 마퀴(드래그 박스) 결과 반영 (additive 옵션)

import { create } from "zustand";
import { FIXTURES_CONFIG, type FixtureType } from "../config/fixtures.config";

export interface FixtureRuntime {
  id: string;
  type: FixtureType;
  position: [number, number, number];
  mount: string;
  on: boolean;
  dimmer: number; // 0..1
  color: string; // #rrggbb
  pan: number; // 0..540 도
  tilt: number; // 0..270 도
  angle: number; // 빔 콘 각도(도)
}

type Editable = Pick<
  FixtureRuntime,
  "on" | "dimmer" | "color" | "pan" | "tilt" | "angle"
>;

interface SceneState {
  fixtures: Record<string, FixtureRuntime>;
  order: string[];
  selectedIds: string[];
  anchorId: string | null;

  // 선택
  selectSingle: (id: string) => void;
  toggleSelect: (id: string) => void;
  rangeSelect: (id: string) => void;
  setSelection: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;

  // 편집
  setPosition: (id: string, pos: [number, number, number]) => void;
  translate: (ids: string[], dx: number, dy: number, dz: number) => void;
  update: (ids: string[], changes: Partial<Editable>) => void;
}

const initialFixtures: Record<string, FixtureRuntime> = Object.fromEntries(
  FIXTURES_CONFIG.map((c) => [
    c.id,
    {
      id: c.id,
      type: c.type,
      position: c.position,
      mount: c.mount,
      on: false,
      dimmer: 1,
      color: "#ffffff",
      pan: 270,
      tilt: 135,
      angle: 25,
    } satisfies FixtureRuntime,
  ]),
);

function patch(
  fixtures: Record<string, FixtureRuntime>,
  id: string,
  changes: Partial<FixtureRuntime>,
): Record<string, FixtureRuntime> {
  const prev = fixtures[id];
  if (!prev) return fixtures;
  return { ...fixtures, [id]: { ...prev, ...changes } };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const useSceneStore = create<SceneState>()((set) => ({
  fixtures: initialFixtures,
  order: FIXTURES_CONFIG.map((c) => c.id),
  selectedIds: [],
  anchorId: null,

  selectSingle: (id) => set({ selectedIds: [id], anchorId: id }),

  toggleSelect: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      return {
        selectedIds: has
          ? s.selectedIds.filter((x) => x !== id)
          : [...s.selectedIds, id],
        anchorId: id,
      };
    }),

  rangeSelect: (id) =>
    set((s) => {
      const anchor = s.anchorId ?? id;
      const i = s.order.indexOf(anchor);
      const j = s.order.indexOf(id);
      if (i < 0 || j < 0) return { selectedIds: [id], anchorId: id };
      const [lo, hi] = i <= j ? [i, j] : [j, i];
      return { selectedIds: s.order.slice(lo, hi + 1), anchorId: anchor };
    }),

  setSelection: (ids, additive = false) =>
    set((s) => ({
      selectedIds: additive
        ? Array.from(new Set([...s.selectedIds, ...ids]))
        : ids,
      anchorId: ids.length ? ids[ids.length - 1] : s.anchorId,
    })),

  clearSelection: () => set({ selectedIds: [], anchorId: null }),

  setPosition: (id, pos) =>
    set((s) => ({ fixtures: patch(s.fixtures, id, { position: pos }) })),

  translate: (ids, dx, dy, dz) =>
    set((s) => {
      let fx = s.fixtures;
      for (const id of ids) {
        const p = fx[id]?.position;
        if (!p) continue;
        fx = patch(fx, id, { position: [p[0] + dx, p[1] + dy, p[2] + dz] });
      }
      return { fixtures: fx };
    }),

  update: (ids, changes) =>
    set((s) => {
      const c: Partial<FixtureRuntime> =
        changes.dimmer !== undefined
          ? { ...changes, dimmer: clamp01(changes.dimmer) }
          : { ...changes };
      let fx = s.fixtures;
      for (const id of ids) fx = patch(fx, id, c);
      return { fixtures: fx };
    }),
}));
