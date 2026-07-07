// components/fixtures/MiniBeam.tsx  (LED Mini Beam 251)
// 소형 빔 무빙헤드: 베이스 + 요크(양팔) + 총알형 헤드.
// 실기 특성 — 좁은 펜슬 빔(1~12°), Pan 540°/Tilt 270°, 어두운 공간에서
// 손전등처럼 쭉 뻗는 빔 → VolumetricBeam으로 표현.

import * as THREE from "three";
import { VolumetricBeam } from "./VolumetricBeam";

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
  pan: number; // 0..540 도
  tilt: number; // 0..270 도
  angle: number; // 빔 전체각(도) 1..12
  /** 픽스처 월드 좌표 — 빔의 바닥/벽 교차 계산용 */
  position: [number, number, number];
}

const d2r = THREE.MathUtils.degToRad;

const HEAD_PIVOT_Y = -0.26; // 베이스 → tilt 피벗
const LENS_OFFSET = 0.16; // 피벗 → 렌즈
const LENS_RADIUS = 0.05;
const REF_ANGLE = 4; // 에너지 보존 기준각

const bodyMat = { color: "#1c1c1f", metalness: 0.5, roughness: 0.5 };

export function MiniBeam({ on, dimmer, color, pan, tilt, angle, position }: Props) {
  return (
    <group>
      {/* 베이스 (트러스 고정부, 디스플레이 박스 포함) */}
      <mesh castShadow>
        <boxGeometry args={[0.24, 0.1, 0.24]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[0, -0.02, 0.11]}>
        <boxGeometry args={[0.14, 0.05, 0.02]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.3} />
      </mesh>

      {/* Pan 회전 (270°=중앙) */}
      <group rotation-y={d2r(pan - 270)}>
        {/* 요크 양팔 */}
        <mesh position={[-0.12, -0.17, 0]} castShadow>
          <boxGeometry args={[0.03, 0.22, 0.07]} />
          <meshStandardMaterial {...bodyMat} />
        </mesh>
        <mesh position={[0.12, -0.17, 0]} castShadow>
          <boxGeometry args={[0.03, 0.22, 0.07]} />
          <meshStandardMaterial {...bodyMat} />
        </mesh>

        {/* Tilt 회전 (135°=중앙, 빔은 로컬 -Y) */}
        <group rotation-x={d2r(tilt - 135)} position={[0, HEAD_PIVOT_Y, 0]}>
          {/* 총알형 헤드: 몸통(앞이 살짝 넓은 원통) + 뒷캡 */}
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.085, 0.28, 20]} />
            <meshStandardMaterial {...bodyMat} />
          </mesh>
          <mesh position={[0, 0.14, 0]} castShadow>
            <sphereGeometry args={[0.07, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial {...bodyMat} />
          </mesh>
          {/* 전면 렌즈 (발광) */}
          <mesh position={[0, -0.141, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.055, 24]} />
            <meshStandardMaterial
              color="#0a0a0a"
              emissive={color}
              emissiveIntensity={on ? Math.max(0.4, dimmer * 2) : 0.03}
              toneMapped={false}
            />
          </mesh>

          <VolumetricBeam
            on={on}
            dimmer={dimmer}
            color={color}
            angle={angle}
            refAngle={REF_ANGLE}
            position={position}
            pan={pan}
            tilt={tilt}
            headOffsetY={HEAD_PIVOT_Y}
            lensLocal={[0, -LENS_OFFSET, 0]}
            lensRadius={LENS_RADIUS}
          />
        </group>
      </group>
    </group>
  );
}
