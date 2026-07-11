// store/effect-engine.ts
// 셰이프/이펙트 제너레이터의 rAF 오실레이션 엔진.
// 실행 중인 각 이펙트를 매 프레임 계산해 그룹 픽스처의 팬/틸트/디머 오프셋(liveOffsets)을 만든다.
//  - BPM 동기: 경과 시간을 "박자"로 누적(beats += dt·bpm/60) — 탭 템포로 BPM이 바뀌어도 위상 연속.
//  - 여러 이펙트가 같은 픽스처를 건드리면: 팬/틸트는 합산, 디머 배율은 곱산(§레이어 합성).
//  - liveOffsets는 undo/영속 대상이 아니다(라이브 렌더 레이어).
// scene-store와 순환 import지만 함수 호출 시점에만 참조하므로 런타임 안전(fade-engine과 동일 패턴).

import { useSceneStore } from "./scene-store";
import type { EffectDef, LiveOffset } from "./console-types";

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
let beats = 0; // 누적 박자(위상 기준)

/**
 * 이펙트 강도(0..1). 페이더 슬롯에 올라가 있으면 그 레벨(Flash=1)이 크기를 제어(실기기 방식).
 * 슬롯에 없으면 화면 실행 버튼(running)으로 0/1.
 */
function effectIntensity(
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

// effect: 이펙트 정의, base: 시간 위상(rad), phaseK: 이 픽스처의 위상 오프셋(rad)
// intensity: 페이더 레벨(0..1) — 크기/깊이를 스케일(실기기: 페이더가 셰이프 크기를 제어)
function shapeOffset(effect: EffectDef, base: number, phaseK: number, acc: LiveOffset, intensity: number) {
  const { shape } = effect;
  const size = effect.size * intensity;
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

function tick(now: number) {
  const state = useSceneStore.getState();
  const dt = lastTime ? (now - lastTime) / 1000 : 0;
  lastTime = now;
  beats += dt * (state.bpm / 60);

  const offsets: Record<string, LiveOffset> = {};
  let activeCount = 0;

  for (const eff of state.effects) {
    const intensity = effectIntensity(state, eff.id, eff.running);
    if (intensity <= 0) continue;
    const group = state.groups.find((g) => g.id === eff.groupId);
    if (!group || group.fixtureIds.length === 0) continue;
    activeCount++;
    const ids = group.fixtureIds;
    const spreadRad = d2r(eff.spread); // 픽스처당 위상차 (Titan Phase 모델)
    const base = (TAU * beats) / Math.max(0.01, eff.beatsPerCycle) * eff.direction;

    ids.forEach((id, k) => {
      if (!state.fixtures[id]) return;
      const phaseK = spreadRad * k;
      const acc = offsets[id] ?? (offsets[id] = { pan: 0, tilt: 0, dimMul: 1 });
      shapeOffset(eff, base, phaseK, acc, intensity);
    });
  }

  useSceneStore.getState().setLiveOffsets(offsets);

  if (activeCount > 0) {
    rafHandle = requestAnimationFrame(tick);
  } else {
    rafHandle = null;
    lastTime = 0;
  }
}

/** 이펙트 상태 변경(실행/정지, 페이더 레벨 등) 후 호출 — 활성 이펙트가 있으면 루프를 켠다. */
export function syncEffectEngine(): void {
  const state = useSceneStore.getState();
  const anyActive = state.effects.some((e) => effectIntensity(state, e.id, e.running) > 0);
  if (anyActive && rafHandle == null) {
    lastTime = 0;
    rafHandle = requestAnimationFrame(tick);
  }
  // 활성 이펙트가 없으면 tick이 스스로 멈추며 마지막에 빈 offsets를 써서 원위치 복귀.
}
