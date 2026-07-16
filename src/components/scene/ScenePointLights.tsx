// components/scene/ScenePointLights.tsx
// 광원(light) 오브젝트들의 실제 pointLight를 한곳에서 "풀(pool)"로 렌더한다.
//
// 이유(성능): three.js는 씬의 조명 개수를 모든 머티리얼 셰이더에 상수로 박으므로,
// 조명이 하나 늘어날 때마다 씬 전체 셰이더를 동기 재컴파일한다(복사-붙여넣기 순간 프리즈).
// 그래서 pointLight 개수를 POOL_STEP(4) 단위로 고정하고 여분은 강도 0으로 채워,
// 풀 크기가 유지되는 동안(광원 1→4개 등)은 재컴파일이 전혀 일어나지 않게 한다.
// 풀 경계(4→5개 등)를 넘을 때만 한 번 재컴파일된다.
//
// SceneLight(픽스처 쪽)는 시각 핸들(구체)만 남기고, 빛은 여기서 위치를 동기해 낸다.
// 포인트 라이트는 회전/스케일 무관 — 픽스처 position만 따라가면 된다.

import { useShallow } from "zustand/react/shallow";
import { useSceneStore, selectEffectiveDimmer } from "../../store/scene-store";

const BASE_INTENSITY = 20;
const REACH = 22; // 도달 거리(distance) — SceneLight와 동일 값 유지
const POOL_STEP = 4;

/** 활성 슬롯 — 광원 픽스처 하나의 위치/색/밝기를 pointLight에 동기 */
function PooledLight({ id }: { id: string }) {
  const f = useSceneStore((s) => s.fixtures[id]);
  const dimmer = useSceneStore((s) => selectEffectiveDimmer(s, id));
  const castShadow = useSceneStore((s) => s.shadowsEnabled);
  if (!f) return null;
  return (
    <pointLight
      position={f.position}
      intensity={dimmer * BASE_INTENSITY}
      distance={REACH}
      decay={1.4}
      color={f.color}
      castShadow={castShadow}
      shadow-mapSize-width={512}
      shadow-mapSize-height={512}
      shadow-bias={-0.0015}
    />
  );
}

export function ScenePointLights() {
  // 광원 픽스처 id 목록 — 변화 없으면 리렌더 없음(useShallow)
  const lightIds = useSceneStore(
    useShallow((s) => s.order.filter((id) => s.fixtures[id]?.type === "light")),
  );
  const n = lightIds.length;
  const pool = Math.max(POOL_STEP, Math.ceil(n / POOL_STEP) * POOL_STEP);
  return (
    <>
      {lightIds.map((id) => (
        <PooledLight key={id} id={id} />
      ))}
      {/* 여분 슬롯 — 강도 0으로 개수만 유지(셰이더의 조명 카운트 고정) */}
      {Array.from({ length: pool - n }, (_, i) => (
        <pointLight
          key={`spare-${i}`}
          position={[0, -999, 0]}
          intensity={0}
          distance={0.01}
        />
      ))}
    </>
  );
}
