// store/console-types.ts
// 조명 콘솔(그룹 · 룩 · 간이 플레이백 페이더) 데이터 모델.
// 구현 명세서 §3 참조. scene-store.ts의 SceneState에 이 필드들이 평평하게(flatten) 붙는다.

export interface FixtureGroupDef {
  id: string;
  name: string;
  fixtureIds: string[];
  masterLevel: number; // 0..1, 기본 1
  color?: string; // 버튼 표시용 라벨 색 (옵션)
}

// 룩에 저장되는 픽스처별 값 — 저장 시점에 존재/의미 있는 어트리뷰트만 기록
export interface LookValues {
  color?: string; // 색 있는 타입만 (movingHead, par, strobe, light)
  pan?: number; // movingHead, par만
  tilt?: number; // movingHead, par만
  dimmer?: number; // 항상 포함 (D-1)
  on?: boolean; // 항상 포함 (D-1)
}

export interface LookDef {
  id: string;
  name: string;
  values: Record<string /* fixtureId */, LookValues>;
  fadeMs: number;
}

export type FaderAssignment =
  | { kind: "look"; lookId: string }
  | { kind: "groupMaster"; groupId: string };

export interface FaderSlot {
  assignment: FaderAssignment | null;
  level: number; // 0..1
  /** 누르는 동안 슬롯 레벨을 1로 간주(런타임 전용 · 비영속 · undo 미기록) */
  flashHeld: boolean;
}

export const FADER_SLOT_COUNT = 10;
export const DEFAULT_LOOK_FADE_MS = 2000; // D-2

// ─── 셰이프/이펙트 제너레이터 ───
// 그룹의 팬/틸트/디머에 BPM 동기 반복 오실레이션을 얹는다.
//  - circle    : pan=size·sin, tilt=size·cos (수직 두 축 90° 위상차 → 원)
//  - figure8   : pan=size·sin, tilt=size·sin(2θ) (8자)
//  - pan       : pan=size·sin (좌우 스윕)
//  - tilt      : tilt=size·sin (상하 스윕)
//  - dimmerWave: 현재 밝기를 물결처럼 오르내리게 곱함(디머 웨이브/체이스)
export type ShapeType = "circle" | "figure8" | "pan" | "tilt" | "dimmerWave";

export interface EffectDef {
  id: string;
  name: string;
  groupId: string; // 대상 그룹
  shape: ShapeType;
  /** 진폭 — 움직임: 도(°) 0..90, dimmerWave: 깊이 0..1 */
  size: number;
  /** 한 사이클에 걸리는 박자 수 (작을수록 빠름). BPM과 동기 */
  beatsPerCycle: number;
  /** 그룹 내 위상 분산(도) 0..360 — 클수록 물결처럼 번져 돈다 */
  spread: number;
  /** 진행 방향 (+1 정방향 / -1 역방향) */
  direction: 1 | -1;
  /** 실행 중 여부 */
  running: boolean;
}

/** 이펙트 엔진이 매 프레임 써 넣는 렌더용 오프셋(런타임 전용 · 비영속 · undo 미기록) */
export interface LiveOffset {
  pan: number; // 도(°) 가산
  tilt: number; // 도(°) 가산
  dimMul: number; // 0..1 곱산
}

export const DEFAULT_BPM = 120;
