// components/fixtures/Bar.tsx
// LED 바 (가로형 워시 조명) — 긴 막대 본체 + 전면 발광 스트립 + 앞으로 퍼지는 넓은 빛.
// on/dimmer/color 조절. 기본 방향은 정면(+Z). 회전 기즈모로 방향 변경 가능.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
}

const bodyMat = { color: "#141416", metalness: 0.4, roughness: 0.6 };
const LENGTH = 1.6; // 바 가로 길이
const CELL = 8; // 발광 셀 개수

export function Bar({ on, dimmer, color }: Props) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (lightRef.current) lightRef.current.target = target;
  }, [target]);

  const cells = useMemo(
    () =>
      Array.from({ length: CELL }, (_, i) => -LENGTH / 2 + (LENGTH / CELL) * (i + 0.5)),
    [],
  );

  const emissive = on ? Math.max(0.4, dimmer * 2.2) : 0.04;

  return (
    <group>
      {/* 본체 */}
      <mesh castShadow>
        <boxGeometry args={[LENGTH, 0.14, 0.12]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      {/* 전면 발광 셀 (정면 +Z) */}
      {cells.map((x, i) => (
        <mesh key={i} position={[x, 0, 0.062]}>
          <planeGeometry args={[LENGTH / CELL - 0.03, 0.1]} />
          <meshStandardMaterial
            color="#0a0a0a"
            emissive={color}
            emissiveIntensity={emissive}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* 앞으로 퍼지는 넓은 워시 */}
      <primitive object={target} position={[0, 0, 3]} />
      <spotLight
        ref={lightRef}
        position={[0, 0, 0.07]}
        angle={Math.PI / 2.4}
        penumbra={0.8}
        distance={12}
        decay={1.3}
        intensity={on ? dimmer * 25 : 0}
        color={color}
      />
    </group>
  );
}
