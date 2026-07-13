// store/effect-engine.ts
// 셰이프/이펙트 제너레이터의 rAF 오실레이션 엔진.
// 실행 중인 각 이펙트를 매 프레임 계산해 그룹 픽스처의 팬/틸트/디머 오프셋(liveOffsets)을 만든다.
//  - 위상 누적: 소스별로 phase += dt·(bpm/60)/beatsPerCycle·TAU·direction·speedMul 를 적산한다.
//    (무상태 파생 대신 누적 → Speed on Fader로 속도를 실시간 바꿔도 위상이 점프하지 않음. BPM 탭도 연속.)
//  - 여러 이펙트가 같은 픽스처를 건드리면: 팬/틸트는 합산, 디머 배율은 곱산(§레이어 합성).
//  - liveOffsets는 undo/영속 대상이 아니다(라이브 렌더 레이어).
// scene-store와 순환 import지만 함수 호출 시점에만 참조하므로 런타임 안전(fade-engine과 동일 패턴).

import { useSceneStore } from "./scene-store";
import type { ShapeType, LiveOffset, ShapeOnFader } from "./console-types";

/** 셰이프 오실레이션에 필요한 최소 필드 — EffectDef와 EffectSnapshot 양쪽이 구조적으로 만족한다. */
interface ShapeSource {
  shape: ShapeType;
  size: number;
  beatsPerCycle: number;
  spread: number;
  direction: 1 | -1;
  step?: boolean;
  fixtureIds: string[];
}

const TAU = Math.PI * 2;
const d2r = (d: number) => (d * Math.PI) / 180;
const wrap = (x: number) => ((x % TAU) + TAU) % TAU;
/** 두 각(rad) 사이 최단 거리 0..π */
function angDist(a: number, b: number): number {
  const d = Math.abs(wrap(a) - wrap(b));
  return Math.min(d, TAU - d);
}

let rafHandle: number | null = null;
let lastTime = 0;
// 소스 키(이펙트 id 또는 `${lookId}:${index}`) → 누적 위상(rad). 매 프레임 갱신.
const phaseAcc = new Map<string, number>();

/** 페이더 모드가 결정하는 크기/속도 배율 (§4-1 표) */
function faderMul(mode: ShapeOnFader | undefined, intensity: number): { sizeMul: number; speedMul: number } {
  switch (mode ?? "size") {
    case "speed":
      return { sizeMul: 1, speedMul: intensity };
    case "both":
      return { sizeMul: intensity, speedMul: intensity };
    case "none":
      return { sizeMul: 1, speedMul: 1 };
    case "size":
    default:
      return { sizeMul: intensity, speedMul: 1 };
  }
}

/**
 * 이펙트 강도(0..1). 페이더 슬롯에 올라가 있으면 그 레벨(Flash=1)이 크기를 제어(실기기 방식).
 * 슬롯에 없으면 화면 실행 버튼(running)으로 0/1.
 */
export function effectIntensity(
  state: ReturnType<typeof useSceneStore.getState>,
  effectId: string,
  running: boolean,
): number {
  const slot = state.faderSlots.find(
    (sl) => sl.assignment?.kind === "effect" && sl.assignment.effectId === effectId,
  );
  if (slot) return slot.flashHeld ? 1 : slot.level;
  return running ? 1 : 0;
}

// effect: 이펙트 정의, base: 누적 위상(rad), phaseK: 이 픽스처의 위상 오프셋(rad)
// sizeMul: 크기/깊이 배율(0..1) — size 모드면 페이더 레벨, speed/none 모드면 1(풀 사이즈)
function shapeOffset(effect: ShapeSource, base: number, phaseK: number, acc: LiveOffset, sizeMul: number) {
  const { shape } = effect;
  const size = effect.size * sizeMul;
  const phase = base + phaseK;
  switch (shape) {
    case "circle":
      acc.pan += size * Math.sin(phase);
      acc.tilt += size * Math.cos(phase);
      break;
    case "figure8":
      acc.pan += size * Math.sin(phase);
      acc.tilt += size * Math.sin(2 * phase);
      break;
    case "pan":
      acc.pan += size * Math.sin(phase);
      break;
    case "tilt":
      acc.tilt += size * Math.sin(phase);
      break;
    case "dimmerWave": {
      if (effect.step) {
        // Step(체이스): 이동하는 헤드(base)가 이 픽스처의 위상 슬롯(phaseK)을 지날 때만 풀 점등.
        // 창 폭 = 위상 간격(phaseK 스텝)의 절반 → 한 번에 한 위상그룹만 켜짐.
        const spreadRad = d2r(effect.spread);
        const win = spreadRad > 0.001 ? spreadRad / 2 : Math.PI / 2;
        const on = angDist(phaseK, base) < win;
        acc.dimMul *= on ? 1 : 1 - size;
      } else {
        const wave01 = (Math.sin(phase) + 1) / 2; // 0..1
        acc.dimMul *= 1 - size + size * wave01; // [1-size, 1]
      }
      break;
    }
  }
}

/** 한 소스를 fixtureIds 대상에 적용(누적 위상 base 사용). 적용 여부 반환. */
function applySource(
  state: ReturnType<typeof useSceneStore.getState>,
  src: ShapeSource,
  base: number,
  sizeMul: number,
  offsets: Record<string, LiveOffset>,
): boolean {
  if (src.fixtureIds.length === 0) return false;
  const spreadRad = d2r(src.spread); // 픽스처당 위상차 (Titan Phase 모델)
  let touched = false;
  src.fixtureIds.forEach((id, k) => {
    if (!state.fixtures[id]) return; // 삭제된 픽스처는 조용히 스킵
    const phaseK = spreadRad * k;
    const acc = offsets[id] ?? (offsets[id] = { pan: 0, tilt: 0, dimMul: 1 });
    shapeOffset(src, base, phaseK, acc, sizeMul);
    touched = true;
  });
  return touched;
}

/** 소스 위상을 dt만큼 전진시키고(speedMul 반영) 적용. 적용 여부 반환. */
function advanceApply(
  state: ReturnType<typeof useSceneStore.getState>,
  key: string,
  src: ShapeSource,
  mode: ShapeOnFader | undefined,
  intensity: number,
  dt: number,
  beatsPerSec: number,
  offsets: Record<string, LiveOffset>,
  seen: Set<string>,
): boolean {
  const { sizeMul, speedMul } = faderMul(mode, intensity);
  const prev = phaseAcc.get(key) ?? 0;
  const base =
    prev + (dt * beatsPerSec * TAU * src.direction * speedMul) / Math.max(0.01, src.beatsPerCycle);
  phaseAcc.set(key, base);
  seen.add(key);
  return applySource(state, src, base, sizeMul, offsets);
}

function tick(now: number) {
  const state = useSceneStore.getState();
  const dt = lastTime ? (now - lastTime) / 1000 : 0;
  lastTime = now;
  const beatsPerSec = state.bpm / 60;

  const offsets: Record<string, LiveOffset> = {};
  const seen = new Set<string>();
  let activeCount = 0;

  // 계열 A — standalone 이펙트(셰이프 전용 큐 포함). 모드는 eff.shapeOnFader
  for (const eff of state.effects) {
    const intensity = effectIntensity(state, eff.id, eff.running);
    if (intensity <= 0) continue;
    if (advanceApply(state, eff.id, eff, eff.shapeOnFader, intensity, dt, beatsPerSec, offsets, seen))
      activeCount++;
  }

  // 계열 B — 룩 슬롯에 내장된 셰이프 스냅샷(레벨>0 또는 Flash). 모드는 룩 단위(look.shapeOnFader)
  for (const slot of state.faderSlots) {
    const a = slot.assignment;
    if (a?.kind !== "look") continue;
    const intensity = slot.flashHeld ? 1 : slot.level;
    if (intensity <= 0) continue;
    const look = state.looks.find((l) => l.id === a.lookId);
    if (!look?.effects?.length) continue;
    look.effects.forEach((snap, i) => {
      if (
        advanceApply(state, `${look.id}:${i}`, snap, look.shapeOnFader, intensity, dt, beatsPerSec, offsets, seen)
      )
        activeCount++;
    });
  }

  // 이번 프레임에 비활성이던 소스 위상은 폐기(재활성 시 0부터 재시작 — 실기기 셰이프 재발동과 유사)
  for (const k of phaseAcc.keys()) if (!seen.has(k)) phaseAcc.delete(k);

  useSceneStore.getState().setLiveOffsets(offsets);

  if (activeCount > 0) {
    rafHandle = requestAnimationFrame(tick);
  } else {
    rafHandle = null;
    lastTime = 0;
    phaseAcc.clear();
  }
}

/** 이펙트 상태 변경(실행/정지, 페이더 레벨 등) 후 호출 — 활성 이펙트가 있으면 루프를 켠다. */
export function syncEffectEngine(): void {
  const state = useSceneStore.getState();
  // 계열 A: standalone 이펙트
  const anyEffectActive = state.effects.some((e) => effectIntensity(state, e.id, e.running) > 0);
  // 계열 B: 셰이프 포함 룩이 올라간(레벨>0 또는 Flash) 슬롯
  const anyLookShapeActive = state.faderSlots.some((sl) => {
    const a = sl.assignment;
    if (a?.kind !== "look") return false;
    if ((sl.flashHeld ? 1 : sl.level) <= 0) return false;
    const look = state.looks.find((l) => l.id === a.lookId);
    return !!look?.effects?.length;
  });
  const anyActive = anyEffectActive || anyLookShapeActive;
  if (anyActive && rafHandle == null) {
    lastTime = 0;
    rafHandle = requestAnimationFrame(tick);
  }
  // 활성 이펙트가 없으면 tick이 스스로 멈추며 마지막에 빈 offsets를 써서 원위치 복귀.
}
