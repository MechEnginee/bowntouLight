// store/scene-store.ts
// 픽스처/표면 런타임 상태 + 다중 선택 + 변형(이동·회전·크기) + 히스토리 단일 진실 소스.
//  - 선택: selectSingle / toggleSelect(Ctrl) / rangeSelect(Shift) / setSelection(마퀴)
//  - 변형: translate / rotateBy / scaleBy — 기즈모 모드는 transformMode(1/2/3키)로 전환
//  - 관리: addObject / removeObjects(Delete) / copySelection·paste(Ctrl+C/V)
//  - 히스토리: undo/redo — 드래그·슬라이더처럼 연속된 같은 조작은 한 스텝으로 합침

import { create } from "zustand";
import * as THREE from "three";
import { FIXTURES_CONFIG, type FixtureType } from "../config/fixtures.config";

export type TransformMode = "translate" | "rotate" | "scale";
export type Vec3 = [number, number, number];

// ─── JSON 내보내기/불러오기 형식 ───
export const SCENE_FORMAT = "worship-lighting-scene";
export const SCENE_VERSION = 1;

export interface SceneObjectFile {
  objectId: string; // 내부 관리용 해시 id
  name: string; // 사람이 보는 이름
  objectType: FixtureType;
  objectTransform: {
    position: Vec3;
    rotation: Vec3; // 라디안
    scale: Vec3;
  };
  objectProperty: {
    on: boolean;
    dimmer: number;
    color: string;
    pan: number;
    tilt: number;
    angle: number;
    strobeRate: number;
    mount: string;
  };
}

export interface SceneFile {
  format: typeof SCENE_FORMAT;
  version: number;
  exportedAt: string;
  sceneName: string;
  scene: {
    backgroundColor: [number, number, number];
    brightness: number;
    sunPosition: Vec3;
  };
  objects: SceneObjectFile[];
}

export interface FixtureRuntime {
  /** 내부 관리용 고유 id (랜덤 10자리 해시) — 사람이 보는 라벨은 name */
  id: string;
  /** 사람이 보는 표시 이름 (예: moving-1) — 목록·패널 표기용 */
  name: string;
  type: FixtureType;
  position: Vec3;
  rotation: Vec3; // Euler XYZ (라디안)
  scale: Vec3;
  mount: string;
  on: boolean;
  dimmer: number; // 0..1
  color: string; // #rrggbb — 라이트는 빔색, 벽/바닥은 표면색
  pan: number; // 0..540 도
  tilt: number; // 0..270 도
  angle: number; // 빔 전체각(도) — movingHead 5..60, par(미니빔) 1..12
  strobeRate: number; // 스트로브 플래시 속도(Hz), 0 = 상시 점등
}

type Editable = Pick<
  FixtureRuntime,
  "on" | "dimmer" | "color" | "pan" | "tilt" | "angle" | "strobeRate"
>;

interface Snapshot {
  fixtures: Record<string, FixtureRuntime>;
  order: string[];
  selectedIds: string[];
  anchorId: string | null;
}

interface SceneState extends Snapshot {
  transformMode: TransformMode;
  clipboard: FixtureRuntime[];
  past: Snapshot[];
  future: Snapshot[];
  /** 씬 명칭 — 좌상단에서 표시·수정 */
  sceneName: string;
  /** 씬 전역 환경광 밝기 (0=암전, 1=기본) — 좌상단 컨트롤로 조절 */
  sceneBrightness: number;
  /** 메인 방향광(그림자 담당) 위치 — 좌상단 컨트롤로 조절 */
  lightPosition: Vec3;
  /** Scene 배경색 [R,G,B] (0~255) */
  backgroundColor: [number, number, number];

  setSceneName: (name: string) => void;
  setSceneBrightness: (v: number) => void;
  setLightPosition: (axis: 0 | 1 | 2, value: number) => void;
  setBackgroundChannel: (channel: 0 | 1 | 2, value: number) => void;

  // 내보내기/불러오기 (JSON)
  exportScene: () => SceneFile;
  importScene: (data: unknown) => { ok: boolean; error?: string };

  // 선택
  selectSingle: (id: string) => void;
  toggleSelect: (id: string) => void;
  rangeSelect: (id: string) => void;
  setSelection: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;

  // 변형/편집
  setTransformMode: (mode: TransformMode) => void;
  setPosition: (id: string, pos: Vec3) => void;
  translate: (ids: string[], dx: number, dy: number, dz: number) => void;
  /** 쿼터니언 델타 [x,y,z,w]를 각 오브젝트 회전 앞에 곱한다 (제자리 회전) */
  rotateBy: (ids: string[], dq: [number, number, number, number]) => void;
  /** 축별 배율을 곱한다 */
  scaleBy: (ids: string[], factor: Vec3) => void;
  /** 우측 패널 숫자 입력 — position/rotation/scale의 한 축을 절대값으로 설정 */
  setAxisValue: (
    ids: string[],
    prop: "position" | "rotation" | "scale",
    axis: 0 | 1 | 2,
    value: number,
  ) => void;
  update: (ids: string[], changes: Partial<Editable>) => void;

  // 오브젝트 관리
  addObject: (type: FixtureType) => void;
  removeObjects: (ids: string[]) => void;
  copySelection: () => void;
  paste: () => void;

  // 히스토리
  undo: () => void;
  redo: () => void;
}

const DEFAULT_COLOR: Partial<Record<FixtureType, string>> = {
  wall: "#0d0d12",
  floor: "#151515",
};

const defaultAngle = (t: FixtureType) => (t === "par" ? 4 : 25);

/** 랜덤 10자리 해시 id 생성 (내부 관리용) */
export function genId(): string {
  const s = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return s.slice(0, 10).padEnd(10, "0");
}

// 초기 픽스처: config의 읽기 쉬운 id는 name으로 쓰고, 내부 id는 해시로 새로 발급
const initialList: FixtureRuntime[] = FIXTURES_CONFIG.map((c) => ({
  id: genId(),
  name: c.id,
  type: c.type,
  position: c.position,
  rotation: c.rotation ?? [0, 0, 0],
  scale: [1, 1, 1],
  mount: c.mount,
  // 배치형 광원은 기본 점등 상태
  on: c.type === "light",
  dimmer: 1,
  color: DEFAULT_COLOR[c.type] ?? "#ffffff",
  pan: 270,
  tilt: 135,
  angle: defaultAngle(c.type),
  strobeRate: 8,
}));

const initialFixtures: Record<string, FixtureRuntime> = Object.fromEntries(
  initialList.map((f) => [f.id, f]),
);
const initialOrder: string[] = initialList.map((f) => f.id);

const ID_PREFIX: Record<FixtureType, string> = {
  movingHead: "moving",
  par: "par",
  strobe: "strobe",
  hazer: "hazer",
  wall: "wall",
  floor: "floor",
  light: "light",
};

/** 타입 접두어 기준으로 다음 표시 이름 생성 (예: moving-9) — 기존 name들과 겹치지 않게 */
function nextName(type: FixtureType, existingNames: string[]): string {
  const prefix = ID_PREFIX[type];
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const nm of existingNames) {
    const m = nm.match(re);
    if (m) max = Math.max(max, +m[1]);
  }
  return `${prefix}-${max + 1}`;
}

/** 목록의 "+ 추가" 버튼으로 새로 만드는 오브젝트 기본값 */
function defaultObject(type: FixtureType, id: string, name: string): FixtureRuntime {
  const base: FixtureRuntime = {
    id,
    name,
    type,
    position: [0, 3, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    mount: "사용자 추가",
    on: false,
    dimmer: 1,
    color: DEFAULT_COLOR[type] ?? "#ffffff",
    pan: 270,
    tilt: 135,
    angle: defaultAngle(type),
    strobeRate: 8,
  };
  if (type === "floor") {
    base.position = [0, 0.02, 0];
    base.rotation = [-Math.PI / 2, 0, 0];
    base.scale = [0.5, 0.5, 1];
  }
  if (type === "wall") {
    base.position = [0, 4, 0];
    base.scale = [0.5, 1, 1];
  }
  if (type === "hazer") base.position = [0, 0.5, 0];
  if (type === "light") {
    base.position = [0, 6, 4];
    base.on = true; // 광원은 추가 즉시 점등
  }
  return base;
}

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
const clampScale = (v: number) => Math.max(0.05, Math.min(50, v));

// ─── 히스토리 ───
// 변형 직전 상태를 past에 쌓는다. 같은 key의 연속 조작(기즈모 드래그, 슬라이더)이
// COALESCE_MS 안에 이어지면 첫 스냅샷만 남기고 합친다 → Ctrl+Z 한 번에 되돌아감.
const HISTORY_MAX = 50;
const COALESCE_MS = 800;
let lastKey: string | null = null;
let lastTime = 0;

const snap = (s: Snapshot): Snapshot => ({
  fixtures: s.fixtures,
  order: s.order,
  selectedIds: s.selectedIds,
  anchorId: s.anchorId,
});

function record(s: SceneState, key: string | null): Partial<SceneState> {
  const now = Date.now();
  const merge = key !== null && key === lastKey && now - lastTime < COALESCE_MS;
  lastKey = key;
  lastTime = now;
  if (merge) return {};
  return { past: [...s.past.slice(-(HISTORY_MAX - 1)), snap(s)], future: [] };
}

export const useSceneStore = create<SceneState>()((set, get) => ({
  fixtures: initialFixtures,
  order: initialOrder,
  selectedIds: [],
  anchorId: null,
  transformMode: "translate",
  clipboard: [],
  past: [],
  future: [],
  sceneName: "새 씬",
  sceneBrightness: 0.5,
  lightPosition: [5, 10, 7],
  backgroundColor: [13, 13, 13], // #0d0d0d

  setSceneName: (name) => set({ sceneName: name }),

  setSceneBrightness: (v) =>
    set({ sceneBrightness: Math.max(0, Math.min(2, v)) }),

  setLightPosition: (axis, value) =>
    set((s) => {
      const p = [...s.lightPosition] as Vec3;
      p[axis] = value;
      return { lightPosition: p };
    }),

  setBackgroundChannel: (channel, value) =>
    set((s) => {
      const c = [...s.backgroundColor] as [number, number, number];
      c[channel] = Math.max(0, Math.min(255, Math.round(value)));
      return { backgroundColor: c };
    }),

  // ─── 내보내기/불러오기 ───
  exportScene: (): SceneFile => {
    const s = get();
    const objects: SceneObjectFile[] = s.order
      .map((id) => s.fixtures[id])
      .filter(Boolean)
      .map((f) => ({
        objectId: f.id,
        name: f.name,
        objectType: f.type,
        objectTransform: {
          position: [...f.position] as Vec3,
          rotation: [...f.rotation] as Vec3,
          scale: [...f.scale] as Vec3,
        },
        objectProperty: {
          on: f.on,
          dimmer: f.dimmer,
          color: f.color,
          pan: f.pan,
          tilt: f.tilt,
          angle: f.angle,
          strobeRate: f.strobeRate,
          mount: f.mount,
        },
      }));
    return {
      format: SCENE_FORMAT,
      version: SCENE_VERSION,
      exportedAt: new Date().toISOString(),
      sceneName: s.sceneName,
      scene: {
        backgroundColor: [...s.backgroundColor] as [number, number, number],
        brightness: s.sceneBrightness,
        sunPosition: [...s.lightPosition] as Vec3,
      },
      objects,
    };
  },

  importScene: (data) => {
    // 형식 검증
    if (!data || typeof data !== "object")
      return { ok: false, error: "JSON 형식이 아닙니다." };
    const d = data as Partial<SceneFile>;
    if (d.format !== SCENE_FORMAT)
      return { ok: false, error: "이 앱의 씬 파일이 아닙니다 (format 불일치)." };
    if (!Array.isArray(d.objects))
      return { ok: false, error: "objects 배열이 없습니다." };

    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    const vec = (v: unknown, fb: Vec3): Vec3 =>
      Array.isArray(v) && v.length === 3 ? [num(v[0], fb[0]), num(v[1], fb[1]), num(v[2], fb[2])] : fb;

    const fixtures: Record<string, FixtureRuntime> = {};
    const order: string[] = [];
    try {
      for (const o of d.objects as SceneObjectFile[]) {
        // 불러온 objectId가 없거나 중복이면 새로 발급 (교체 방식이라 name은 그대로 유지)
        let id = typeof o.objectId === "string" && o.objectId ? o.objectId : genId();
        if (fixtures[id]) id = genId();
        const t = o.objectTransform ?? ({} as SceneObjectFile["objectTransform"]);
        const p = o.objectProperty ?? ({} as SceneObjectFile["objectProperty"]);
        fixtures[id] = {
          id,
          name: typeof o.name === "string" ? o.name : id,
          type: o.objectType,
          position: vec(t.position, [0, 3, 0]),
          rotation: vec(t.rotation, [0, 0, 0]),
          scale: vec(t.scale, [1, 1, 1]),
          mount: typeof p.mount === "string" ? p.mount : "",
          on: !!p.on,
          dimmer: num(p.dimmer, 1),
          color: typeof p.color === "string" ? p.color : "#ffffff",
          pan: num(p.pan, 270),
          tilt: num(p.tilt, 135),
          angle: num(p.angle, defaultAngle(o.objectType)),
          strobeRate: num(p.strobeRate, 8),
        };
        order.push(id);
      }
    } catch {
      return { ok: false, error: "오브젝트 파싱 중 오류가 발생했습니다." };
    }

    const sc = d.scene ?? ({} as SceneFile["scene"]);
    const bg = sc.backgroundColor;
    set({
      fixtures,
      order,
      selectedIds: [],
      anchorId: null,
      clipboard: [],
      past: [],
      future: [],
      sceneName: typeof d.sceneName === "string" ? d.sceneName : "불러온 씬",
      sceneBrightness: num(sc.brightness, 0.5),
      lightPosition: vec(sc.sunPosition, [5, 10, 7]),
      backgroundColor:
        Array.isArray(bg) && bg.length === 3
          ? [num(bg[0], 13), num(bg[1], 13), num(bg[2], 13)]
          : [13, 13, 13],
    });
    return { ok: true };
  },

  // ─── 선택 (히스토리 미기록) ───
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

  // ─── 변형/편집 ───
  setTransformMode: (mode) => set({ transformMode: mode }),

  setPosition: (id, pos) =>
    set((s) => ({
      ...record(s, `pos:${id}`),
      fixtures: patch(s.fixtures, id, { position: pos }),
    })),

  translate: (ids, dx, dy, dz) =>
    set((s) => {
      const hist = record(s, `translate:${ids.join(",")}`);
      let fx = s.fixtures;
      for (const id of ids) {
        const p = fx[id]?.position;
        if (!p) continue;
        fx = patch(fx, id, { position: [p[0] + dx, p[1] + dy, p[2] + dz] });
      }
      return { ...hist, fixtures: fx };
    }),

  rotateBy: (ids, dq) =>
    set((s) => {
      const hist = record(s, `rotate:${ids.join(",")}`);
      const delta = new THREE.Quaternion(dq[0], dq[1], dq[2], dq[3]);
      let fx = s.fixtures;
      for (const id of ids) {
        const f = fx[id];
        if (!f) continue;
        const cur = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(f.rotation[0], f.rotation[1], f.rotation[2]),
        );
        const e = new THREE.Euler().setFromQuaternion(
          delta.clone().multiply(cur),
        );
        fx = patch(fx, id, { rotation: [e.x, e.y, e.z] });
      }
      return { ...hist, fixtures: fx };
    }),

  scaleBy: (ids, factor) =>
    set((s) => {
      const hist = record(s, `scale:${ids.join(",")}`);
      let fx = s.fixtures;
      for (const id of ids) {
        const sc = fx[id]?.scale;
        if (!sc) continue;
        fx = patch(fx, id, {
          scale: [
            clampScale(sc[0] * factor[0]),
            clampScale(sc[1] * factor[1]),
            clampScale(sc[2] * factor[2]),
          ],
        });
      }
      return { ...hist, fixtures: fx };
    }),

  setAxisValue: (ids, prop, axis, value) =>
    set((s) => {
      const hist = record(s, `axis:${prop}:${axis}:${ids.join(",")}`);
      let fx = s.fixtures;
      for (const id of ids) {
        const f = fx[id];
        if (!f) continue;
        const arr = [...f[prop]] as Vec3;
        arr[axis] = prop === "scale" ? clampScale(value) : value;
        fx = patch(fx, id, { [prop]: arr } as Partial<FixtureRuntime>);
      }
      return { ...hist, fixtures: fx };
    }),

  update: (ids, changes) =>
    set((s) => {
      const hist = record(
        s,
        `update:${Object.keys(changes).join(",")}:${ids.join(",")}`,
      );
      const c: Partial<FixtureRuntime> =
        changes.dimmer !== undefined
          ? { ...changes, dimmer: clamp01(changes.dimmer) }
          : { ...changes };
      let fx = s.fixtures;
      for (const id of ids) fx = patch(fx, id, c);
      return { ...hist, fixtures: fx };
    }),

  // ─── 오브젝트 관리 ───
  addObject: (type) =>
    set((s) => {
      const hist = record(s, null);
      const id = genId();
      const name = nextName(
        type,
        s.order.map((oid) => s.fixtures[oid]?.name ?? ""),
      );
      return {
        ...hist,
        fixtures: { ...s.fixtures, [id]: defaultObject(type, id, name) },
        order: [...s.order, id],
        selectedIds: [id],
        anchorId: id,
      };
    }),

  removeObjects: (ids) =>
    set((s) => {
      if (ids.length === 0) return {};
      const hist = record(s, null);
      const del = new Set(ids);
      return {
        ...hist,
        fixtures: Object.fromEntries(
          Object.entries(s.fixtures).filter(([id]) => !del.has(id)),
        ),
        order: s.order.filter((id) => !del.has(id)),
        selectedIds: s.selectedIds.filter((id) => !del.has(id)),
        anchorId: s.anchorId && del.has(s.anchorId) ? null : s.anchorId,
      };
    }),

  copySelection: () =>
    set((s) => ({
      // 깊은 복사로 담아둬 원본이 삭제/변형돼도 붙여넣기 가능
      clipboard: s.selectedIds
        .map((id) => s.fixtures[id])
        .filter(Boolean)
        .map((f) => ({
          ...f,
          position: [...f.position] as Vec3,
          rotation: [...f.rotation] as Vec3,
          scale: [...f.scale] as Vec3,
        })),
    })),

  paste: () =>
    set((s) => {
      if (s.clipboard.length === 0) return {};
      const hist = record(s, null);
      const fx = { ...s.fixtures };
      const order = [...s.order];
      const newIds: string[] = [];
      for (const src of s.clipboard) {
        const id = genId();
        const name = nextName(
          src.type,
          order.map((oid) => fx[oid]?.name ?? ""),
        );
        fx[id] = {
          ...src,
          id,
          name,
          position: [src.position[0] + 0.5, src.position[1], src.position[2] + 0.5],
          mount: "복사됨",
        };
        order.push(id);
        newIds.push(id);
      }
      return {
        ...hist,
        fixtures: fx,
        order,
        selectedIds: newIds,
        anchorId: newIds[0] ?? null,
      };
    }),

  // ─── 히스토리 ───
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return {};
      lastKey = null;
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [...s.future, snap(s)],
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1];
      if (!next) return {};
      lastKey = null;
      return {
        ...next,
        future: s.future.slice(0, -1),
        past: [...s.past.slice(-(HISTORY_MAX - 1)), snap(s)],
      };
    }),
}));
