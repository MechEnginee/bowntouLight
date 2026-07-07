// components/fixtures/StrobeLight.tsx  (LED Strobe 패널)
// 실기 형태 — 넓은 패널에 LED 스트립이 가로로 배열된 형태 + 상단 행거 브래킷.
// 기능 — 플래시 속도(Hz) 제어: rate>0이면 점멸, rate=0이면 상시 점등.
// 점멸은 useFrame에서 재질/라이트를 직접 변조해 스토어 리렌더 없이 처리.

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  on: boolean;
  dimmer: number;
  rate: number; // 플래시 속도(Hz), 0 = 상시 점등
}

const bodyMat = { color: "#141416", metalness: 0.4, roughness: 0.6 };
const FLASH_DUTY = 0.14; // 한 주기 중 발광 비율

export function StrobeLight({ on, dimmer, rate }: Props) {
  const lightRef = useRef<THREE.PointLight>(null);
  // 두 스트립이 공유하는 재질 — useFrame에서 점멸 변조
  const stripMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#262626", toneMapped: false }),
    [],
  );
  useEffect(() => () => stripMat.dispose(), [stripMat]);

  useFrame(({ clock }) => {
    let level = 0;
    if (on) {
      if (rate <= 0) level = 1;
      else level = (clock.elapsedTime * rate) % 1 < FLASH_DUTY ? 1 : 0.02;
    }
    const v = level * dimmer;
    // 꺼짐: 어두운 회색 렌즈 / 켜짐: 흰색 발광
    stripMat.color.setScalar(0.15 + v * 0.85);
    if (lightRef.current) {
      lightRef.current.intensity = v * 15;
    }
  });

  return (
    <group>
      {/* 행거 브래킷 */}
      <mesh position={[0, 0.19, 0]} castShadow>
        <boxGeometry args={[0.3, 0.03, 0.05]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[-0.24, 0.06, 0]} castShadow>
        <boxGeometry args={[0.025, 0.28, 0.05]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[0.24, 0.06, 0]} castShadow>
        <boxGeometry args={[0.025, 0.28, 0.05]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* 패널 본체 */}
      <mesh castShadow>
        <boxGeometry args={[0.44, 0.28, 0.09]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* LED 스트립 2열 (공유 재질 — useFrame에서 점멸) */}
      <mesh position={[0, 0.06, 0.047]} material={stripMat}>
        <planeGeometry args={[0.4, 0.085]} />
      </mesh>
      <mesh position={[0, -0.06, 0.047]} material={stripMat}>
        <planeGeometry args={[0.4, 0.085]} />
      </mesh>

      {/* 플래시 라이트 (전방) */}
      <pointLight ref={lightRef} position={[0, 0, 0.4]} distance={7} intensity={0} color="#ffffff" />
    </group>
  );
}
