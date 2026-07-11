// store/fade-engine.ts
// 룩 적용/페이더 래치의 값 페이드(보간) 엔진. rAF 루프로 픽스처별 진행 중인 페이드를 갱신한다.
//  - 여러 픽스처를 동시에, 서로 다른 목표값으로 페이드할 수 있다.
//  - 같은 픽스처에 새 페이드가 시작되면 기존 것을 취소하고 "현재 값"에서 다시 시작한다.
//  - 여기서 쓰는 store 갱신(applyWithoutHistory)은 undo 히스토리에 기록되지 않는다.
//    undo 1스텝이 필요한 호출부(applyLook)는 페이드 시작 전에 별도로 record()를 호출해야 한다.

import { useSceneStore, type FixtureRuntime } from "./scene-store";
import { hexToRgb, rgbToHex, type Rgb } from "../components/ui/color-utils";
import type { LookValues } from "./console-types";

interface ActiveFade {
  fromColor?: Rgb;
  toColor?: Rgb;
  fromPan?: number;
  toPan?: number;
  fromTilt?: number;
  toTilt?: number;
  fromDimmer?: number;
  toDimmer?: number;
  start: number;
  duration: number;
}

const active = new Map<string, ActiveFade>();
let rafHandle: number | null = null;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function tick(now: number) {
  const { applyWithoutHistory } = useSceneStore.getState();
  const patches: Record<string, Partial<FixtureRuntime>> = {};

  for (const [id, f] of active) {
    const t = f.duration <= 0 ? 1 : Math.min(1, (now - f.start) / f.duration);
    const p: Partial<FixtureRuntime> = {};
    if (f.toPan !== undefined) p.pan = lerp(f.fromPan!, f.toPan, t);
    if (f.toTilt !== undefined) p.tilt = lerp(f.fromTilt!, f.toTilt, t);
    if (f.toDimmer !== undefined) p.dimmer = lerp(f.fromDimmer!, f.toDimmer, t);
    if (f.toColor) {
      const c = f.fromColor!;
      const g = f.toColor;
      p.color = rgbToHex([lerp(c[0], g[0], t), lerp(c[1], g[1], t), lerp(c[2], g[2], t)]);
    }
    patches[id] = p;
    if (t >= 1) active.delete(id);
  }

  if (Object.keys(patches).length > 0) applyWithoutHistory(patches);

  rafHandle = active.size > 0 ? requestAnimationFrame(tick) : null;
}

function ensureLoop() {
  if (rafHandle == null) rafHandle = requestAnimationFrame(tick);
}

/**
 * 픽스처 하나를 목표 LookValues로 페이드한다.
 * - includeDimmer=false면 dimmer는 건드리지 않는다 (페이더 래치 경로 — dimmer는 HTP로만 흐름, §4.4).
 * - on은 페이드 대상이 아니라 시작 시 즉시(1회) 반영한다.
 * - 같은 픽스처에 이미 진행 중인 페이드가 있으면 취소하고 새로 시작(현재 값 기준).
 */
export function startFade(
  fixtureId: string,
  target: LookValues,
  durationMs: number,
  includeDimmer: boolean,
): void {
  const store = useSceneStore.getState();
  const f = store.fixtures[fixtureId];
  if (!f) return;

  if (target.on !== undefined) {
    store.applyWithoutHistory({ [fixtureId]: { on: target.on } });
  }

  const fade: ActiveFade = { start: performance.now(), duration: durationMs };
  let has = false;
  if (target.pan !== undefined) {
    fade.fromPan = f.pan;
    fade.toPan = target.pan;
    has = true;
  }
  if (target.tilt !== undefined) {
    fade.fromTilt = f.tilt;
    fade.toTilt = target.tilt;
    has = true;
  }
  if (target.color !== undefined) {
    fade.fromColor = hexToRgb(f.color);
    fade.toColor = hexToRgb(target.color);
    has = true;
  }
  if (includeDimmer && target.dimmer !== undefined) {
    fade.fromDimmer = f.dimmer;
    fade.toDimmer = target.dimmer;
    has = true;
  }

  if (!has) return;
  active.set(fixtureId, fade);
  ensureLoop();
}

export function cancelFade(fixtureId: string): void {
  active.delete(fixtureId);
}
