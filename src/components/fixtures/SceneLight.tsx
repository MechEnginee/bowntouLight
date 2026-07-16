// components/fixtures/SceneLight.tsx
// 배치형 광원(포인트 라이트) — 목록 추가/선택/기즈모/삭제되는 오브젝트.
// 무대·픽스처·벽을 비추는 보조광. 시각 핸들(발광 구체)은 클릭 선택 가능하고,
// 실제 빛은 pointLight로 낸다. 밝기=dimmer, 색=color, On/Off로 토글.
// 성능: 포인트 라이트 큐브 섀도우는 매우 비싸므로(6면 렌더/프레임) 기본 off.
//   씬 그림자는 방향광(sun)이 담당. 필요 시 전역 토글(pointLightShadows)로 켠다.

import { useSceneStore } from "../../store/scene-store";

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
}

const BASE_INTENSITY = 20;
const REACH = 22; // 도달 거리(distance)

export function SceneLight({ on, dimmer, color }: Props) {
  const castShadow = useSceneStore((s) => s.pointLightShadows);
  return (
    <group>
      {/* 시각 핸들 — 발광 구체(클릭 선택 대상) */}
      <mesh>
        <sphereGeometry args={[0.18, 20, 16]} />
        <meshBasicMaterial color={on ? color : "#444455"} toneMapped={false} />
      </mesh>
      {/* 광선 느낌의 외곽 헤일로 */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={on ? 0.18 : 0.04}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        intensity={on ? dimmer * BASE_INTENSITY : 0}
        distance={REACH}
        decay={1.4}
        color={color}
        castShadow={castShadow}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0015}
      />
    </group>
  );
}
