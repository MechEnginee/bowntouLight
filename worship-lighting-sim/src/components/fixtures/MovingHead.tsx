// components/fixtures/MovingHead.tsx  (GBR 4012)
// 제어형 시각 컴포넌트: 스토어 런타임 상태를 props로 받아 반영한다.
// yoke(Pan) → head(Tilt) 중첩 회전, spotLight로 On/색/밝기/빔각도 표현.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
  pan: number; // 0..540 도
  tilt: number; // 0..270 도
  angle: number; // 빔 콘 각도(도)
}

const d2r = THREE.MathUtils.degToRad;

export function MovingHead({ on, dimmer, color, pan, tilt, angle }: Props) {
  const lightRef = useRef<THREE.SpotLight>(null);
  // 스팟라이트가 head 로컬 -Y(아래)를 향하도록 target을 자식으로 붙인다.
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (lightRef.current) lightRef.current.target = target;
  }, [target]);

  return (
    <group>
      {/* 베이스 (트러스 고정부) */}
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.15, 0.3]} />
        <meshStandardMaterial color="#333" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Pan 회전 (270°=중앙 → 0 rad) */}
      <group rotation-y={d2r(pan - 270)}>
        {/* Tilt 회전 (135°=중앙 → 0 rad, 빔이 바로 아래로) */}
        <group rotation-x={d2r(tilt - 135)} position={[0, -0.2, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#222" metalness={0.4} roughness={0.6} />
          </mesh>
          {/* head 로컬 아래쪽 타깃 */}
          <primitive object={target} position={[0, -5, 0]} />
          <spotLight
            ref={lightRef}
            position={[0, 0, 0]}
            angle={d2r(angle)}
            penumbra={0.3}
            distance={20}
            intensity={on ? dimmer * 8 : 0}
            color={color}
            castShadow
          />
        </group>
      </group>
    </group>
  );
}
