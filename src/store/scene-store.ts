// store/scene-store.ts
// 픽스처/표면 런타임 상태 + 다중 선택 + 변형(이동·회전·크기) + 히스토리 단일 진실 소스.
//  - 선택: selectSingle / toggleSelect(Ctrl) / rangeSelect(Shift) / setSelection(마퀴)
//  - 변형: translate / rotateBy / scaleBy — 기즈모 모드는 transformMode(W/E/R 키)로 전환
//  - 관리: addObject / removeObjects(Delete) / copySelection·paste(Ctrl+C/V)
//  - 히스토리: undo/redo — 드래그·슬라이더처럼 연속된 같은 조작은 한 스텝으로 합침
//  - 콘솔: 그룹/룩/간이 플레이백 페이더 — 구현 명세서(consolefeaturedesign.md) 참조.
//    출력 dimmer는 renderer가 fixtures[id].dimmer를 직접 읽지 않고
//    selectEffectiveDimmer(state, id)를 통해 마스터/페이더 HTP 합성값을 읽는다.

import { create } from "zustand";
import * as THREE from "three";
import { FIXTURES_CONFIG, type FixtureType } from "../config/fixtures.config";
import {
  FADER_SLOT_COUNT,
  DEFAULT_LOOK_FADE_MS,
  DEFAULT_BPM,
  type FixtureGroupDef,
  type LookValues,
  type LookDef,
  type FaderAssignment,
  type FaderSlot,
  type EffectDef,
  type EffectSnapshot,
  type ShapeType,
  type LiveOffset,
} from "./console-types";
import { startFade } from "./fade-engine";
import { syncEffectEngine, effectIntensity } from "./effect-engine";
import { useAudioStore, type AudioMarker, type RecordingBaseline } from "./audio-store";

export type TransformMode = "translate" | "rotate" | "scale";
export type Vec3 = [number, number, number];

// ─── JSON 내보내기/불러오기 형식 ───
export const SCENE_FORMAT = "worship-lighting-scene";
export const SCENE_VERSION = 3;

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
  /** v2+: 그룹/룩/페이더 할당/그랜드마스터. v1 파일엔 없음(불러오기 시 빈 콘솔로 초기화). */
  console?: {
    grandMaster: number;
    groups: Array<{
      id: string;
      name: string;
      fixtureIds: string[];
      masterLevel: number;
      color?: string;
    }>;
    looks: Array<{
      id: string;
      name: string;
      fadeMs: number;
      values: Record<string, LookValues>;
      /** v3+: 큐에 기록된 셰이프 스냅샷 */
      effects?: EffectSnapshot[];
    }>;
    faderSlots: Array<{ assignment: FaderAssignment | null; level: number }>;
    /** 이펙트 속도 동기 BPM */
    bpm?: number;
    /** 셰이프/이펙트 (running 포함 — 저장 시점 실행 상태로 복원) */
    effects?: EffectDef[];
    /** 사용자가 Colours 창에 추가한 커스텀 색(#rrggbb) */
    customColors?: string[];
  };
  /** v2+: 음원 타임라인 — 파일명+길이+메모 마커 + 조명 녹화 저장(오디오 원본은 재로드). */
  audio?: {
    fileName: string | null;
    duration?: number; // 초 — 재링크 시 동일 음원 판정용
    markers: Array<{ id: string; time: number; text: string; color?: string }>;
    /** 조명 녹화 이벤트 (음원 시간축) */
    events?: Array<{ id: string; t: number; kind: string; slot?: number; level?: number; held?: boolean; on?: boolean }>;
    /** 녹화 기준상태 */
    baseline?: { faderLevels: number[]; grandMaster: number; blackout: boolean; bpm?: number } | null;
  };
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
  dimmer: number; // 0..1 — "직접(프로그램)" 값. 최종 출력은 selectEffectiveDimmer 참조.
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
  groups: FixtureGroupDef[];
  looks: LookDef[];
  /** faderSlots의 assignment만 스냅샷(레벨/flashHeld는 라이브 조작이라 undo 대상 아님) */
  faderAssignments: (FaderAssignment | null)[];
}

interface SceneState {
  fixtures: Record<string, FixtureRuntime>;
  order: string[];
  selectedIds: string[];
  anchorId: string | null;
  groups: FixtureGroupDef[];
  looks: LookDef[];
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

  // ─── 콘솔: 그룹/룩/페이더 (faderSlots는 assignment 외 level·flashHeld 포함 — 라이브 상태) ───
  faderSlots: FaderSlot[];
  /** 그랜드 마스터 0..1 */
  grandMaster: number;
  /** 블랙아웃(전체 출력 ×0) */
  blackout: boolean;

  // ─── 콘솔: 셰이프/이펙트 제너레이터 (런타임 전용 — undo/영속 대상 아님) ───
  /** 실행 중/정지 이펙트 목록 */
  effects: EffectDef[];
  /** 이펙트 속도 동기용 BPM (탭 템포로 설정) */
  bpm: number;
  /** 이펙트 엔진이 매 프레임 쓰는 렌더용 오프셋 — 팬/틸트 가산 + 디머 곱산 */
  liveOffsets: Record<string, LiveOffset>;
  /** Colours 창에 사용자가 추가한 커스텀 색(#rrggbb) — 씬 파일에 영속화 */
  customColors: string[];

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
  /**
   * Shift+클릭 범위 선택. 앵커~클릭 사이를 선택한다.
   * orderOverride를 주면 그 순서(= 화면에 보이는 목록 순서)로 범위를 계산한다.
   * 목록(FixtureList/터치스크린 Fixtures)은 타입별로 재정렬해 표시하므로
   * 반드시 화면 순서를 넘겨야 "보이는 대로" 범위가 잡힌다. 미지정 시 store.order 사용.
   */
  rangeSelect: (id: string, orderOverride?: string[]) => void;
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
  /** 픽스처별로 다른 변경치를 undo 히스토리 없이 즉시 반영 (페이드 엔진 전용) */
  applyWithoutHistory: (patches: Record<string, Partial<FixtureRuntime>>) => void;

  // 오브젝트 관리
  addObject: (type: FixtureType) => void;
  removeObjects: (ids: string[]) => void;
  /** 표시 이름(name) 변경 — 목록 더블클릭 인라인 편집 */
  renameObject: (id: string, name: string) => void;
  copySelection: () => void;
  paste: () => void;

  // ─── 콘솔: 그룹 ───
  createGroup: (name?: string) => void;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  updateGroupMembers: (id: string) => void;
  selectGroup: (id: string, additive?: boolean) => void;
  setGroupMaster: (id: string, level: number) => void;

  // ─── 콘솔: 룩 ───
  saveLook: (name?: string) => void;
  applyLook: (id: string) => void;
  updateLook: (id: string) => void;
  renameLook: (id: string, name: string) => void;
  deleteLook: (id: string) => void;
  setLookFade: (id: string, ms: number) => void;

  // ─── 콘솔: 페이더 ───
  assignFader: (slotIndex: number, assignment: FaderAssignment | null) => void;
  setFaderLevel: (slotIndex: number, level: number) => void;
  setFlashHeld: (slotIndex: number, held: boolean) => void;
  setGrandMaster: (level: number) => void;
  toggleBlackout: () => void;
  /** 블랙아웃을 특정 값으로 설정 (조명 녹화 재생 시 사용) */
  setBlackout: (on: boolean) => void;
  /** 조명 녹화 기준상태로 콘솔 라이브 상태를 리셋 (재생/탐색 재구성용) */
  applyRecordingBaseline: (b: RecordingBaseline) => void;

  // ─── 콘솔: 셰이프/이펙트 ───
  /** 지정한 픽스처를 대상으로 이펙트 생성(기본 실행 상태). 대상이 비면 no-op */
  createEffect: (shape: ShapeType, fixtureIds: string[], name?: string) => void;
  updateEffect: (id: string, patch: Partial<EffectDef>) => void;
  removeEffect: (id: string) => void;
  toggleEffect: (id: string) => void;
  /** 모든 이펙트 정지·제거 후 원위치 복귀 */
  clearEffects: () => void;
  setBpm: (bpm: number) => void;
  /** 탭 템포 — 연속 탭 간격으로 BPM 산출 */
  tapTempo: () => void;
  /** 이펙트 엔진 전용: 렌더 오프셋 일괄 반영(undo 미기록) */
  setLiveOffsets: (offsets: Record<string, LiveOffset>) => void;

  // ─── Colours: 커스텀 색 팔레트 ───
  /** Colours 창에 색 추가 (중복·잘못된 hex는 무시) */
  addCustomColor: (hex: string) => void;
  removeCustomColor: (hex: string) => void;

  // 히스토리
  undo: () => void;
  redo: () => void;
}

const DEFAULT_COLOR: Partial<Record<FixtureType, string>> = {
  wall: "#0d0d12",
  floor: "#151515",
  bar: "#3a3a3a", // 트러스 프레임 금속색
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
  // 배치형 광원만 기본 점등 (bar는 구조물이라 on 무관)
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
  bar: "bar",
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

/** 그룹/룩 이름 자동 넘버링 (예: "그룹 1", "룩 1") */
function nextLabel(prefix: string, existingNames: string[]): string {
  const re = new RegExp(`^${prefix} (\\d+)$`);
  let max = 0;
  for (const nm of existingNames) {
    const m = nm.match(re);
    if (m) max = Math.max(max, +m[1]);
  }
  return `${prefix} ${max + 1}`;
}

/** 룩 저장 시 픽스처별 스냅샷 — 타입에 유효한 필드만 기록 (§3) */
function snapshotLookValues(
  fixtures: Record<string, FixtureRuntime>,
  ids: string[],
): Record<string, LookValues> {
  const values: Record<string, LookValues> = {};
  for (const id of ids) {
    const f = fixtures[id];
    if (!f) continue;
    const lv: LookValues = { dimmer: f.dimmer, on: f.on };
    if (
      f.type === "movingHead" ||
      f.type === "par" ||
      f.type === "strobe" ||
      f.type === "light"
    ) {
      lv.color = f.color;
    }
    if (f.type === "movingHead" || f.type === "par") {
      lv.pan = f.pan;
      lv.tilt = f.tilt;
    }
    values[id] = lv;
  }
  return values;
}

function defaultFaderSlots(): FaderSlot[] {
  return Array.from({ length: FADER_SLOT_COUNT }, () => ({
    assignment: null,
    level: 0,
    flashHeld: false,
  }));
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
  if (type === "bar") {
    // 트러스 프레임: 발판이 바닥에 닿도록 중심을 높이 절반에 둔다 (BAR_HEIGHT/2 ≈ 2.35)
    base.position = [0, 2.35, 0];
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
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clampScale = (v: number) => Math.max(0.05, Math.min(50, v));

// ─── 이펙트 프리셋/라벨 ───
const SHAPE_LABEL: Record<ShapeType, string> = {
  circle: "원",
  figure8: "8자",
  pan: "팬",
  tilt: "틸트",
  dimmerWave: "디머",
};
const EFFECT_PRESET: Record<
  ShapeType,
  { size: number; beatsPerCycle: number; spread: number; direction: 1 | -1 }
> = {
  // spread(위상, 도/픽스처): 0=동시. dimmerWave는 생성 시 그룹 크기 기준 360/n으로 덮어씀(한 바퀴 파도).
  circle: { size: 30, beatsPerCycle: 4, spread: 0, direction: 1 },
  figure8: { size: 30, beatsPerCycle: 4, spread: 0, direction: 1 },
  pan: { size: 45, beatsPerCycle: 2, spread: 0, direction: 1 },
  tilt: { size: 25, beatsPerCycle: 2, spread: 0, direction: 1 },
  dimmerWave: { size: 1, beatsPerCycle: 4, spread: 0, direction: 1 },
};

// 룩 저장 시 캡처할 셰이프 스냅샷 계산 — §5-1 / D-1.
//  대상 = 활성(intensity>0) ∧ 선택 픽스처와 교집합. fixtureIds는 교집합으로 축소.
//  반환: 스냅샷 배열 + 캡처된 원본 이펙트 id(저장 후 정지 대상).
function captureEffects(s: SceneState): { snapshots: EffectSnapshot[]; sourceIds: string[] } {
  const sel = new Set(s.selectedIds);
  const snapshots: EffectSnapshot[] = [];
  const sourceIds: string[] = [];
  for (const e of s.effects) {
    if (effectIntensity(s, e.id, e.running) <= 0) continue; // 활성만
    const overlap = e.fixtureIds.filter((fid) => sel.has(fid));
    if (overlap.length === 0) continue; // 선택과 교집합 없으면 제외
    snapshots.push({
      shape: e.shape,
      size: e.size,
      beatsPerCycle: e.beatsPerCycle,
      spread: e.spread,
      direction: e.direction,
      step: e.step,
      fixtureIds: overlap,
    });
    sourceIds.push(e.id);
  }
  return { snapshots, sourceIds };
}

// 탭 템포 타임스탬프 버퍼(런타임 전용)
const tapTimes: number[] = [];

/** "#rgb"/"#rrggbb"/"rrggbb"를 소문자 #rrggbb로 정규화. 잘못된 값이면 null */
function normalizeHex(input: string): string | null {
  if (typeof input !== "string") return null;
  let h = input.trim().toLowerCase();
  if (h[0] !== "#") h = "#" + h;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return /^#[0-9a-f]{6}$/.test(h) ? h : null;
}

// ─── 히스토리 ───
// 변형 직전 상태를 past에 쌓는다. 같은 key의 연속 조작(기즈모 드래그, 슬라이더)이
// COALESCE_MS 안에 이어지면 첫 스냅샷만 남기고 합친다 → Ctrl+Z 한 번에 되돌아감.
const HISTORY_MAX = 50;
const COALESCE_MS = 800;
let lastKey: string | null = null;
let lastTime = 0;

const snap = (s: SceneState): Snapshot => ({
  fixtures: s.fixtures,
  order: s.order,
  selectedIds: s.selectedIds,
  anchorId: s.anchorId,
  groups: s.groups,
  looks: s.looks,
  faderAssignments: s.faderSlots.map((sl) => sl.assignment),
});

function record(s: SceneState, key: string | null): Partial<SceneState> {
  const now = Date.now();
  const merge = key !== null && key === lastKey && now - lastTime < COALESCE_MS;
  lastKey = key;
  lastTime = now;
  if (merge) return {};
  return { past: [...s.past.slice(-(HISTORY_MAX - 1)), snap(s)], future: [] };
}

/**
 * 최종 출력 dimmer(HTP 합성). 렌더 컴포넌트는 f.dimmer 대신 이 값을 구독해야 한다.
 * out(f) = max(direct, ...pb, gflash) × min(그룹 masterLevel) × grandMaster × (blackout?0:1)
 * — 구현 명세서 §4.2
 */
export function selectEffectiveDimmer(state: SceneState, id: string): number {
  if (state.blackout) return 0;
  const f = state.fixtures[id];
  if (!f) return 0;

  const direct = f.on ? f.dimmer : 0;
  let htp = direct;

  for (const slot of state.faderSlots) {
    const a = slot.assignment;
    if (!a) continue;
    if (a.kind === "look") {
      const look = state.looks.find((l) => l.id === a.lookId);
      const lv = look?.values[id];
      if (!lv || lv.dimmer === undefined) continue;
      const slotLevel = slot.flashHeld ? 1 : slot.level;
      const pb = lv.dimmer * slotLevel;
      if (pb > htp) htp = pb;
    } else if (a.kind === "groupMaster" && slot.flashHeld) {
      const group = state.groups.find((g) => g.id === a.groupId);
      if (group && group.fixtureIds.includes(id) && htp < 1) htp = 1;
    }
  }

  let gm = 1;
  for (const g of state.groups) {
    if (!g.fixtureIds.includes(id)) continue;
    const slot = state.faderSlots.find(
      (sl) => sl.assignment?.kind === "groupMaster" && sl.assignment.groupId === g.id,
    );
    const level = slot?.flashHeld ? 1 : g.masterLevel;
    gm = Math.min(gm, level);
  }

  // 디머 웨이브 이펙트 — 현재 출력에 물결 배율(0..1)을 곱한다
  const dimMul = state.liveOffsets[id]?.dimMul ?? 1;

  return htp * gm * state.grandMaster * dimMul;
}

// ─── v2 .btw 콘솔 섹션 방어적 파싱 헬퍼 ───
function coerceGroups(
  raw: unknown,
  fixtures: Record<string, FixtureRuntime>,
): FixtureGroupDef[] {
  if (!Array.isArray(raw)) return [];
  const out: FixtureGroupDef[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const o = g as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    const fixtureIds = Array.isArray(o.fixtureIds)
      ? o.fixtureIds.filter((x): x is string => typeof x === "string" && !!fixtures[x])
      : [];
    out.push({
      id: o.id,
      name: o.name,
      fixtureIds,
      masterLevel:
        typeof o.masterLevel === "number" && Number.isFinite(o.masterLevel)
          ? clamp01(o.masterLevel)
          : 1,
      color: typeof o.color === "string" ? o.color : undefined,
    });
  }
  return out;
}

function coerceLooks(
  raw: unknown,
  fixtures: Record<string, FixtureRuntime>,
): LookDef[] {
  if (!Array.isArray(raw)) return [];
  const out: LookDef[] = [];
  for (const l of raw) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    const rawValues =
      o.values && typeof o.values === "object"
        ? (o.values as Record<string, unknown>)
        : {};
    const values: Record<string, LookValues> = {};
    for (const [fid, v] of Object.entries(rawValues)) {
      if (!fixtures[fid] || !v || typeof v !== "object") continue;
      const vo = v as Record<string, unknown>;
      const lv: LookValues = {};
      if (typeof vo.color === "string") lv.color = vo.color;
      if (typeof vo.pan === "number" && Number.isFinite(vo.pan)) lv.pan = vo.pan;
      if (typeof vo.tilt === "number" && Number.isFinite(vo.tilt)) lv.tilt = vo.tilt;
      if (typeof vo.dimmer === "number" && Number.isFinite(vo.dimmer))
        lv.dimmer = clamp01(vo.dimmer);
      if (typeof vo.on === "boolean") lv.on = vo.on;
      values[fid] = lv;
    }
    out.push({
      id: o.id,
      name: o.name,
      fadeMs:
        typeof o.fadeMs === "number" && Number.isFinite(o.fadeMs)
          ? Math.max(0, o.fadeMs)
          : DEFAULT_LOOK_FADE_MS,
      values,
      effects: coerceEffectSnapshots(o.effects, fixtures),
    });
  }
  return out;
}

function coerceFaderSlots(
  raw: unknown,
  groups: FixtureGroupDef[],
  looks: LookDef[],
  effects: EffectDef[],
): FaderSlot[] {
  const validGroupIds = new Set(groups.map((g) => g.id));
  const validLookIds = new Set(looks.map((l) => l.id));
  const validEffectIds = new Set(effects.map((e) => e.id));
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: FADER_SLOT_COUNT }, (_, i) => {
    const o = arr[i];
    let assignment: FaderAssignment | null = null;
    let level = 0;
    if (o && typeof o === "object") {
      const so = o as Record<string, unknown>;
      const a = so.assignment as Record<string, unknown> | null | undefined;
      if (a && a.kind === "look" && typeof a.lookId === "string" && validLookIds.has(a.lookId)) {
        assignment = { kind: "look", lookId: a.lookId };
      } else if (
        a &&
        a.kind === "groupMaster" &&
        typeof a.groupId === "string" &&
        validGroupIds.has(a.groupId)
      ) {
        assignment = { kind: "groupMaster", groupId: a.groupId };
      } else if (
        a &&
        a.kind === "effect" &&
        typeof a.effectId === "string" &&
        validEffectIds.has(a.effectId)
      ) {
        assignment = { kind: "effect", effectId: a.effectId };
      }
      if (typeof so.level === "number" && Number.isFinite(so.level)) level = clamp01(so.level);
    }
    return { assignment, level, flashHeld: false };
  });
}

const VALID_SHAPES: ShapeType[] = ["circle", "figure8", "pan", "tilt", "dimmerWave"];

// standalone 이펙트 코어싱 + v2(groupId)→v3(fixtureIds) 마이그레이션.
function coerceEffects(
  raw: unknown,
  groups: FixtureGroupDef[],
  fixtures: Record<string, FixtureRuntime>,
): EffectDef[] {
  if (!Array.isArray(raw)) return [];
  const groupMembers = new Map(groups.map((g) => [g.id, g.fixtureIds]));
  const out: EffectDef[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (typeof o.shape !== "string" || !VALID_SHAPES.includes(o.shape as ShapeType)) continue;
    // 대상 해석: v3 fixtureIds 우선, 없으면 v2 groupId를 현재 그룹 멤버로 마이그레이션
    let fixtureIds: string[] | null = null;
    if (Array.isArray(o.fixtureIds)) {
      fixtureIds = o.fixtureIds.filter((x): x is string => typeof x === "string" && !!fixtures[x]);
    } else if (typeof o.groupId === "string" && groupMembers.has(o.groupId)) {
      fixtureIds = groupMembers.get(o.groupId)!.filter((x) => !!fixtures[x]);
    }
    if (!fixtureIds || fixtureIds.length === 0) continue; // 대상 해석 불가 → 드롭
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : genId(),
      name: typeof o.name === "string" ? o.name : "이펙트",
      fixtureIds,
      shape: o.shape as ShapeType,
      size: typeof o.size === "number" && Number.isFinite(o.size) ? o.size : 30,
      beatsPerCycle:
        typeof o.beatsPerCycle === "number" && Number.isFinite(o.beatsPerCycle)
          ? clamp(o.beatsPerCycle, 0.5, 16)
          : 4,
      spread: typeof o.spread === "number" && Number.isFinite(o.spread) ? clamp(o.spread, 0, 360) : 0,
      direction: o.direction === -1 ? -1 : 1,
      step: o.step === true,
      running: o.running !== false,
    });
  }
  return out;
}

// 룩 내장 셰이프 스냅샷 코어싱(존재하는 픽스처만). 비면 undefined.
function coerceEffectSnapshots(
  raw: unknown,
  fixtures: Record<string, FixtureRuntime>,
): EffectSnapshot[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: EffectSnapshot[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (typeof o.shape !== "string" || !VALID_SHAPES.includes(o.shape as ShapeType)) continue;
    const fixtureIds = Array.isArray(o.fixtureIds)
      ? o.fixtureIds.filter((x): x is string => typeof x === "string" && !!fixtures[x])
      : [];
    if (fixtureIds.length === 0) continue;
    out.push({
      shape: o.shape as ShapeType,
      size: typeof o.size === "number" && Number.isFinite(o.size) ? o.size : 30,
      beatsPerCycle:
        typeof o.beatsPerCycle === "number" && Number.isFinite(o.beatsPerCycle)
          ? clamp(o.beatsPerCycle, 0.5, 16)
          : 4,
      spread: typeof o.spread === "number" && Number.isFinite(o.spread) ? clamp(o.spread, 0, 360) : 0,
      direction: o.direction === -1 ? -1 : 1,
      step: o.step === true,
      fixtureIds,
    });
  }
  return out.length ? out : undefined;
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
  groups: [],
  looks: [],
  faderSlots: defaultFaderSlots(),
  grandMaster: 1,
  blackout: false,
  effects: [],
  bpm: DEFAULT_BPM,
  liveOffsets: {},
  customColors: [],

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
      console: {
        grandMaster: s.grandMaster,
        groups: s.groups.map((g) => ({
          id: g.id,
          name: g.name,
          fixtureIds: [...g.fixtureIds],
          masterLevel: g.masterLevel,
          color: g.color,
        })),
        looks: s.looks.map((l) => ({
          id: l.id,
          name: l.name,
          fadeMs: l.fadeMs,
          values: { ...l.values },
          effects: l.effects?.map((sn) => ({ ...sn, fixtureIds: [...sn.fixtureIds] })),
        })),
        faderSlots: s.faderSlots.map((sl) => ({
          assignment: sl.assignment,
          level: sl.level,
        })),
        bpm: s.bpm,
        effects: s.effects.map((e) => ({ ...e })),
        customColors: [...s.customColors],
      },
      audio: (() => {
        const a = useAudioStore.getState();
        return {
          fileName: a.fileName,
          duration: a.loaded ? a.duration : a.savedDuration,
          markers: a.markers.map((m) => ({ ...m })),
          events: a.events.map((e) => ({ ...e })),
          baseline: a.baseline,
        };
      })(),
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

    // v2 콘솔 섹션 (v1이거나 부재 시 빈 콘솔로 초기화 — 하위호환 하드 요구사항)
    const groups = coerceGroups(d.console?.groups, fixtures);
    const looks = coerceLooks(d.console?.looks, fixtures);
    const effects = coerceEffects(d.console?.effects, groups, fixtures);
    const faderSlots = coerceFaderSlots(d.console?.faderSlots, groups, looks, effects);
    const grandMaster = clamp01(num(d.console?.grandMaster, 1));
    const bpm = clamp(num(d.console?.bpm, DEFAULT_BPM), 20, 400);
    const customColors = Array.isArray(d.console?.customColors)
      ? Array.from(
          new Set(
            d.console.customColors
              .map((c) => (typeof c === "string" ? normalizeHex(c) : null))
              .filter((c): c is string => !!c),
          ),
        )
      : [];

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
      groups,
      looks,
      faderSlots,
      grandMaster,
      blackout: false,
      effects,
      bpm,
      liveOffsets: {},
      customColors,
    });
    // 저장 시 실행 중이던 이펙트가 있으면 엔진 재가동
    syncEffectEngine();
    // 음원 타임라인: 파일명+메모 마커 복원(오디오 원본은 사용자가 다시 로드)
    {
      const rawAudio = (d as SceneFile).audio;
      const markers: AudioMarker[] = Array.isArray(rawAudio?.markers)
        ? rawAudio.markers
            .filter(
              (m): m is AudioMarker =>
                !!m && typeof m.time === "number" && Number.isFinite(m.time) && typeof m.text === "string",
            )
            .map((m) => ({ id: typeof m.id === "string" ? m.id : genId(), time: m.time, text: m.text, color: m.color }))
        : [];
      const fileName = typeof rawAudio?.fileName === "string" ? rawAudio.fileName : null;
      const audioDur =
        typeof rawAudio?.duration === "number" && Number.isFinite(rawAudio.duration) ? rawAudio.duration : 0;
      useAudioStore.getState().restoreFromScene(fileName, audioDur, markers);

      // 조명 녹화 이벤트/기준상태 복원 (방어적 파싱)
      const VALID_KINDS = ["fader", "flash", "blackout", "grand"];
      const events = Array.isArray(rawAudio?.events)
        ? rawAudio.events
            .filter(
              (e) =>
                !!e && typeof e.t === "number" && Number.isFinite(e.t) && typeof e.kind === "string" && VALID_KINDS.includes(e.kind),
            )
            .map((e) => ({
              id: typeof e.id === "string" ? e.id : genId(),
              t: e.t,
              kind: e.kind as "fader" | "flash" | "blackout" | "grand",
              slot: typeof e.slot === "number" ? e.slot : undefined,
              level: typeof e.level === "number" ? e.level : undefined,
              held: typeof e.held === "boolean" ? e.held : undefined,
              on: typeof e.on === "boolean" ? e.on : undefined,
            }))
        : [];
      const rawBase = rawAudio?.baseline;
      const baseline =
        rawBase && Array.isArray(rawBase.faderLevels) && typeof rawBase.grandMaster === "number"
          ? {
              faderLevels: rawBase.faderLevels.map((n) => (typeof n === "number" ? clamp01(n) : 0)),
              grandMaster: clamp01(rawBase.grandMaster),
              blackout: rawBase.blackout === true,
              bpm:
                typeof rawBase.bpm === "number" && Number.isFinite(rawBase.bpm)
                  ? clamp(rawBase.bpm, 20, 400)
                  : undefined,
            }
          : null;
      useAudioStore.getState().setRecording(events, baseline);
    }
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

  rangeSelect: (id, orderOverride) =>
    set((s) => {
      const ord = orderOverride ?? s.order;
      const anchor = s.anchorId ?? id;
      let i = ord.indexOf(anchor);
      const j = ord.indexOf(id);
      // 클릭 대상이 이 순서에 없으면 선택 불가 — 단일 선택으로 폴백
      if (j < 0) return { selectedIds: [id], anchorId: id };
      // 앵커가 이 목록에 없으면(다른 창에서 잡힌 앵커 등) 클릭 지점을 앵커로
      if (i < 0) i = j;
      const [lo, hi] = i <= j ? [i, j] : [j, i];
      return { selectedIds: ord.slice(lo, hi + 1), anchorId: anchor };
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

  applyWithoutHistory: (patches) =>
    set((s) => {
      let fx = s.fixtures;
      for (const [id, changes] of Object.entries(patches)) {
        fx = patch(fx, id, changes);
      }
      return { fixtures: fx };
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

  renameObject: (id, name) =>
    set((s) => {
      if (!s.fixtures[id]) return {};
      const hist = record(s, null);
      return { ...hist, fixtures: patch(s.fixtures, id, { name }) };
    }),

  removeObjects: (ids) => {
    set((s) => {
      if (ids.length === 0) return {};
      const hist = record(s, null);
      const del = new Set(ids);
      // 삭제되는 픽스처를 그룹 멤버·룩 값에서도 정리 (정합성 유지)
      const groups = s.groups.map((g) => ({
        ...g,
        fixtureIds: g.fixtureIds.filter((fid) => !del.has(fid)),
      }));
      const looks = s.looks.map((l) => {
        const danglingVals = Object.keys(l.values).some((fid) => del.has(fid));
        const danglingShapes = l.effects?.some((sn) => sn.fixtureIds.some((fid) => del.has(fid)));
        if (!danglingVals && !danglingShapes) return l;
        const values = danglingVals
          ? Object.fromEntries(Object.entries(l.values).filter(([fid]) => !del.has(fid)))
          : l.values;
        let effects = l.effects;
        if (danglingShapes && l.effects) {
          const pruned = l.effects
            .map((sn) => ({ ...sn, fixtureIds: sn.fixtureIds.filter((fid) => !del.has(fid)) }))
            .filter((sn) => sn.fixtureIds.length > 0);
          effects = pruned.length ? pruned : undefined;
        }
        return { ...l, values, effects };
      });
      // standalone 이펙트도 대상 픽스처 정리 — 비면 이펙트 제거
      const effects = s.effects
        .map((e) => ({ ...e, fixtureIds: e.fixtureIds.filter((fid) => !del.has(fid)) }))
        .filter((e) => e.fixtureIds.length > 0);
      return {
        ...hist,
        fixtures: Object.fromEntries(
          Object.entries(s.fixtures).filter(([id]) => !del.has(id)),
        ),
        order: s.order.filter((id) => !del.has(id)),
        selectedIds: s.selectedIds.filter((id) => !del.has(id)),
        anchorId: s.anchorId && del.has(s.anchorId) ? null : s.anchorId,
        groups,
        looks,
        effects,
      };
    });
    syncEffectEngine();
  },

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

  // ─── 콘솔: 그룹 ───
  createGroup: (name) =>
    set((s) => {
      if (s.selectedIds.length === 0) return {};
      const hist = record(s, null);
      const id = genId();
      const group: FixtureGroupDef = {
        id,
        name: name?.trim() || nextLabel("그룹", s.groups.map((g) => g.name)),
        fixtureIds: [...s.selectedIds],
        masterLevel: 1,
      };
      return { ...hist, groups: [...s.groups, group] };
    }),

  renameGroup: (id, name) =>
    set((s) => {
      if (!s.groups.some((g) => g.id === id)) return {};
      const hist = record(s, null);
      return { ...hist, groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)) };
    }),

  deleteGroup: (id) => {
    set((s) => {
      if (!s.groups.some((g) => g.id === id)) return {};
      const hist = record(s, null);
      return {
        ...hist,
        groups: s.groups.filter((g) => g.id !== id),
        faderSlots: s.faderSlots.map((sl) =>
          sl.assignment?.kind === "groupMaster" && sl.assignment.groupId === id
            ? { ...sl, assignment: null }
            : sl,
        ),
        // 이펙트는 이제 그룹이 아닌 fixtureIds 스냅샷을 참조 → 그룹 삭제와 무관하게 유지(§5-5)
      };
    });
    syncEffectEngine();
  },

  updateGroupMembers: (id) =>
    set((s) => {
      if (!s.groups.some((g) => g.id === id)) return {};
      const hist = record(s, null);
      return {
        ...hist,
        groups: s.groups.map((g) =>
          g.id === id ? { ...g, fixtureIds: [...s.selectedIds] } : g,
        ),
      };
    }),

  selectGroup: (id, additive = false) =>
    set((s) => {
      const g = s.groups.find((x) => x.id === id);
      if (!g) return {};
      const valid = g.fixtureIds.filter((fid) => s.fixtures[fid]);
      return {
        selectedIds: additive
          ? Array.from(new Set([...s.selectedIds, ...valid]))
          : valid,
        anchorId: valid[valid.length - 1] ?? s.anchorId,
      };
    }),

  setGroupMaster: (id, level) =>
    set((s) => {
      const clamped = clamp01(level);
      const groups = s.groups.map((g) =>
        g.id === id ? { ...g, masterLevel: clamped } : g,
      );
      // 이 그룹이 페이더에 할당돼 있으면 슬롯 레벨(표시)도 동기
      const faderSlots = s.faderSlots.map((sl) =>
        sl.assignment?.kind === "groupMaster" && sl.assignment.groupId === id
          ? { ...sl, level: clamped }
          : sl,
      );
      return { groups, faderSlots }; // 라이브 조작 — undo 미기록
    }),

  // ─── 콘솔: 룩 ───
  saveLook: (name) => {
    set((s) => {
      if (s.selectedIds.length === 0) return {};
      const hist = record(s, null);
      const id = genId();
      // 활성 셰이프를 큐(룩)에 스냅샷 (§5-1)
      const { snapshots, sourceIds } = captureEffects(s);
      const look: LookDef = {
        id,
        name: name?.trim() || nextLabel("룩", s.looks.map((l) => l.name)),
        values: snapshotLookValues(s.fixtures, s.selectedIds),
        fadeMs: DEFAULT_LOOK_FADE_MS,
        effects: snapshots.length ? snapshots : undefined,
      };
      // D-9: 빈 슬롯이 있으면 자동 할당
      const emptyIdx = s.faderSlots.findIndex((sl) => sl.assignment === null);
      const faderSlots =
        emptyIdx >= 0
          ? s.faderSlots.map((sl, i) =>
              i === emptyIdx
                ? { assignment: { kind: "look" as const, lookId: id }, level: 0, flashHeld: false }
                : sl,
            )
          : s.faderSlots;
      // D-2: 캡처된 프리뷰 이펙트 정지(running=false). 슬롯에 올라간 건 슬롯이 강도를 유지.
      const stop = new Set(sourceIds);
      const effects = stop.size
        ? s.effects.map((e) => (stop.has(e.id) ? { ...e, running: false } : e))
        : s.effects;
      return { ...hist, looks: [...s.looks, look], faderSlots, effects };
    });
    syncEffectEngine();
  },

  applyLook: (id) =>
    set((s) => {
      const look = s.looks.find((l) => l.id === id);
      if (!look) return {};
      const hist = record(s, null); // 룩 적용 전체 = undo 1스텝
      for (const [fid, lv] of Object.entries(look.values)) {
        if (s.fixtures[fid]) startFade(fid, lv, look.fadeMs, true); // dimmer 포함
      }
      return { ...hist };
    }),

  updateLook: (id) => {
    let changed = false;
    set((s) => {
      if (!s.looks.some((l) => l.id === id) || s.selectedIds.length === 0) return {};
      const hist = record(s, null);
      const { snapshots, sourceIds } = captureEffects(s); // §5-2 재스냅샷
      const stop = new Set(sourceIds);
      const effects = stop.size
        ? s.effects.map((e) => (stop.has(e.id) ? { ...e, running: false } : e))
        : s.effects;
      changed = true;
      return {
        ...hist,
        looks: s.looks.map((l) =>
          l.id === id
            ? {
                ...l,
                values: snapshotLookValues(s.fixtures, s.selectedIds),
                effects: snapshots.length ? snapshots : undefined,
              }
            : l,
        ),
        effects,
      };
    });
    if (changed) syncEffectEngine();
  },

  renameLook: (id, name) =>
    set((s) => {
      if (!s.looks.some((l) => l.id === id)) return {};
      const hist = record(s, null);
      return { ...hist, looks: s.looks.map((l) => (l.id === id ? { ...l, name } : l)) };
    }),

  deleteLook: (id) =>
    set((s) => {
      if (!s.looks.some((l) => l.id === id)) return {};
      const hist = record(s, null);
      return {
        ...hist,
        looks: s.looks.filter((l) => l.id !== id),
        faderSlots: s.faderSlots.map((sl) =>
          sl.assignment?.kind === "look" && sl.assignment.lookId === id
            ? { ...sl, assignment: null }
            : sl,
        ),
      };
    }),

  setLookFade: (id, ms) =>
    set((s) => {
      if (!s.looks.some((l) => l.id === id)) return {};
      const hist = record(s, null);
      return {
        ...hist,
        looks: s.looks.map((l) => (l.id === id ? { ...l, fadeMs: Math.max(0, ms) } : l)),
      };
    }),

  // ─── 콘솔: 페이더 ───
  assignFader: (slotIndex, assignment) => {
    const prev = get().faderSlots[slotIndex]?.assignment;
    set((s) => {
      if (!s.faderSlots[slotIndex]) return {};
      const hist = record(s, null);
      let level = 0;
      if (assignment?.kind === "groupMaster") {
        const g = s.groups.find((x) => x.id === assignment.groupId);
        level = g?.masterLevel ?? 1;
      }
      const faderSlots = s.faderSlots.map((sl, i) =>
        i === slotIndex ? { assignment, level, flashHeld: false } : sl,
      );
      return { ...hist, faderSlots };
    });
    // 이펙트가 얽힌 슬롯이면 엔진 재동기(화면 실행 → 페이더 제어 전환 등)
    if (assignment?.kind === "effect" || prev?.kind === "effect") syncEffectEngine();
  },

  setFaderLevel: (slotIndex, level) => {
    const pre = get();
    const preSlot = pre.faderSlots[slotIndex];
    const preAssign = preSlot?.assignment;
    const wasEffect = preAssign?.kind === "effect";
    // 셰이프 포함 룩 슬롯의 0↔양수 경계에서만 엔진 재동기(§5-3 — 드래그 중 남발 방지)
    let lookShapeBoundary = false;
    if (preAssign?.kind === "look") {
      const look = pre.looks.find((l) => l.id === preAssign.lookId);
      if (look?.effects?.length) {
        const wasPos = preSlot.level > 0;
        const nowPos = clamp01(level) > 0;
        lookShapeBoundary = wasPos !== nowPos;
      }
    }
    set((s) => {
      const slot = s.faderSlots[slotIndex];
      if (!slot) return {};
      const clamped = clamp01(level);
      const wasZero = slot.level <= 0;
      const becomesPositive = clamped > 0;
      const a = slot.assignment;

      let groups = s.groups;
      if (a?.kind === "groupMaster") {
        groups = s.groups.map((g) => (g.id === a.groupId ? { ...g, masterLevel: clamped } : g));
      }

      const faderSlots = s.faderSlots.map((sl, i) =>
        i === slotIndex ? { ...sl, level: clamped } : sl,
      );

      // 룩 슬롯의 0→상승 에지: 색/pan/tilt 래치 페이드 (undo 미기록).
      // on은 래치하지 않는다 — 페이더 밝기는 HTP(pb)로만 흐르고, 빔 점등은 유효밝기>0로 판정.
      // (on을 켜면 직접경로 f.dimmer가 풀로 기여해 페이더가 무시되고 제어패널 on이 켜지는 문제)
      if (a?.kind === "look" && wasZero && becomesPositive) {
        const look = s.looks.find((l) => l.id === a.lookId);
        if (look) {
          for (const [fid, lv] of Object.entries(look.values)) {
            if (s.fixtures[fid]) startFade(fid, { ...lv, on: undefined }, look.fadeMs, false);
          }
        }
      }

      return { faderSlots, groups }; // 라이브 조작 — undo 미기록
    });
    if (wasEffect || lookShapeBoundary) syncEffectEngine(); // 이펙트/셰이프룩 레벨 경계 → 엔진 시작/정지
    const as = useAudioStore.getState();
    if (as.recording) as.recordEvent({ kind: "fader", slot: slotIndex, level: clamp01(level) });
  },

  setFlashHeld: (slotIndex, held) => {
    const pre = get();
    const preAssign = pre.faderSlots[slotIndex]?.assignment;
    const isEffect = preAssign?.kind === "effect";
    // 셰이프 포함 룩 슬롯의 Flash → 엔진 시작(정지는 tick 자기 종료). idempotent하므로 항상 호출해도 안전.
    let lookHasShapes = false;
    if (preAssign?.kind === "look") {
      const look = pre.looks.find((l) => l.id === preAssign.lookId);
      lookHasShapes = !!look?.effects?.length;
    }
    set((s) => {
      const slot = s.faderSlots[slotIndex];
      if (!slot) return {};
      const faderSlots = s.faderSlots.map((sl, i) =>
        i === slotIndex ? { ...sl, flashHeld: held } : sl,
      );
      // 룩 슬롯: 레벨이 0인 상태에서 Flash를 누르면 활성화 에지로 간주해 래치도 발동 (on 제외)
      const a = slot.assignment;
      if (held && slot.level <= 0 && a?.kind === "look") {
        const look = s.looks.find((l) => l.id === a.lookId);
        if (look) {
          for (const [fid, lv] of Object.entries(look.values)) {
            if (s.fixtures[fid]) startFade(fid, { ...lv, on: undefined }, look.fadeMs, false);
          }
        }
      }
      return { faderSlots }; // 라이브 조작 — undo 미기록
    });
    if (isEffect || lookHasShapes) syncEffectEngine(); // 이펙트/셰이프룩 슬롯 Flash → 엔진 시작/정지
    const as = useAudioStore.getState();
    if (as.recording) as.recordEvent({ kind: "flash", slot: slotIndex, held });
  },

  setGrandMaster: (level) => {
    set({ grandMaster: clamp01(level) });
    const as = useAudioStore.getState();
    if (as.recording) as.recordEvent({ kind: "grand", level: clamp01(level) });
  },

  toggleBlackout: () => {
    set((s) => ({ blackout: !s.blackout }));
    const as = useAudioStore.getState();
    if (as.recording) as.recordEvent({ kind: "blackout", on: get().blackout });
  },

  setBlackout: (on) => set({ blackout: on }),

  applyRecordingBaseline: (b) => {
    set((s) => ({
      faderSlots: s.faderSlots.map((sl, i) => ({ ...sl, level: b.faderLevels[i] ?? 0, flashHeld: false })),
      grandMaster: b.grandMaster,
      blackout: b.blackout,
      // D-8: 녹화 시점 BPM 복원(있으면) — 셰이프 속도를 녹화 당시와 일치
      bpm: typeof b.bpm === "number" && Number.isFinite(b.bpm) ? clamp(b.bpm, 20, 400) : s.bpm,
    }));
    syncEffectEngine(); // 이펙트/셰이프룩 페이더가 기준값에 있으면 엔진 재동기
  },

  // ─── 셰이프/이펙트 ───
  createEffect: (shape, fixtureIds, name) => {
    const s = get();
    const ids = fixtureIds.filter((id) => s.fixtures[id]);
    if (ids.length === 0) return;
    const preset = EFFECT_PRESET[shape];
    // dimmerWave는 대상 전체에 한 바퀴 파도가 흐르도록 위상 기본값 = 360/n
    const spread =
      shape === "dimmerWave" ? Math.round(360 / Math.max(1, ids.length)) : preset.spread;
    const eff: EffectDef = {
      id: genId(),
      name: name?.trim() || `${SHAPE_LABEL[shape]} ${ids.length}대`,
      fixtureIds: [...ids],
      shape,
      running: true,
      step: false,
      ...preset,
      spread,
    };
    set({ effects: [...s.effects, eff] });
    syncEffectEngine();
  },

  updateEffect: (id, patch) =>
    set((s) => ({
      effects: s.effects.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  removeEffect: (id) => {
    set((s) => ({
      effects: s.effects.filter((e) => e.id !== id),
      // 이 이펙트를 참조하는 페이더 슬롯 해제
      faderSlots: s.faderSlots.map((sl) =>
        sl.assignment?.kind === "effect" && sl.assignment.effectId === id
          ? { ...sl, assignment: null }
          : sl,
      ),
    }));
    syncEffectEngine();
  },

  toggleEffect: (id) => {
    set((s) => ({
      effects: s.effects.map((e) => (e.id === id ? { ...e, running: !e.running } : e)),
    }));
    syncEffectEngine();
  },

  clearEffects: () =>
    set((s) => ({
      effects: [],
      liveOffsets: {},
      faderSlots: s.faderSlots.map((sl) =>
        sl.assignment?.kind === "effect" ? { ...sl, assignment: null } : sl,
      ),
    })),

  setBpm: (bpm) => set({ bpm: clamp(bpm, 20, 400) }),

  tapTempo: () => {
    const now = performance.now();
    // 2초 넘게 끊기면 새 시퀀스로 리셋
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes.length = 0;
    tapTimes.push(now);
    if (tapTimes.length > 6) tapTimes.shift();
    if (tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avg > 0) set({ bpm: clamp(Math.round(60000 / avg), 20, 400) });
    }
  },

  setLiveOffsets: (offsets) => set({ liveOffsets: offsets }),

  // ─── Colours: 커스텀 색 ───
  addCustomColor: (hex) =>
    set((s) => {
      const norm = normalizeHex(hex);
      if (!norm || s.customColors.includes(norm)) return {};
      return { customColors: [...s.customColors, norm] };
    }),

  removeCustomColor: (hex) =>
    set((s) => {
      const norm = normalizeHex(hex);
      return { customColors: s.customColors.filter((c) => c !== norm) };
    }),

  // ─── 히스토리 ───
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return {};
      lastKey = null;
      const faderSlots = s.faderSlots.map((sl, i) => ({
        ...sl,
        assignment: prev.faderAssignments[i] ?? null,
      }));
      return {
        fixtures: prev.fixtures,
        order: prev.order,
        selectedIds: prev.selectedIds,
        anchorId: prev.anchorId,
        groups: prev.groups,
        looks: prev.looks,
        faderSlots,
        past: s.past.slice(0, -1),
        future: [...s.future, snap(s)],
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1];
      if (!next) return {};
      lastKey = null;
      const faderSlots = s.faderSlots.map((sl, i) => ({
        ...sl,
        assignment: next.faderAssignments[i] ?? null,
      }));
      return {
        fixtures: next.fixtures,
        order: next.order,
        selectedIds: next.selectedIds,
        anchorId: next.anchorId,
        groups: next.groups,
        looks: next.looks,
        faderSlots,
        future: s.future.slice(0, -1),
        past: [...s.past.slice(-(HISTORY_MAX - 1)), snap(s)],
      };
    }),
}));
