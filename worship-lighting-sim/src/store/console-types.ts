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
