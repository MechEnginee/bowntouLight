// components/fixtures/MovingHead.tsx  (LED Wash Moving — 19×15W Bee-Eye 타입)
// 워시 무빙헤드: 베이스 + 요크(양팔) + 두꺼운 헤드 + 19구 렌즈 전면부.
// 실기 특성 — 넓은 줌(5~60°), Pan 540°/Tilt 270°, RGBW 컬러 믹싱.
// 빔: 렌즈 19개 각각에서 가는 레이가 나가고, 줌을 넓히면 바깥 링일수록
// 바깥쪽으로 기울어 부채꼴(꽃모양)로 갈라진다 — Bee-Eye 특유의 멀티 레이.

import { useMemo } from "react";
import * as THREE from "three";
import { VolumetricBeam } from "./VolumetricBeam";

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
  pan: number; // 0..540 도
  tilt: number; // 0..270 도
  angle: number; // 빔 전체각(도) 5..60
  /** 픽스처 월드 좌표 — 빔의 바닥/벽 교차 계산용 */
  position: [number, number, number];
}

const d2r = THREE.MathUtils.degToRad;

const HEAD_PIVOT_Y = -0.3; // 베이스 → tilt 피벗
const FACE_Y = -0.125; // 피벗 → 렌즈면(로컬 Y)
const REF_ANGLE = 25; // 에너지 보존 기준각

const bodyMat = { color: "#232326", metalness: 0.5, roughness: 0.5 };

/** 19구 렌즈 배치: 중앙 1 + 안쪽 링 6 + 바깥 링 12 (헥사 패턴) */
function lensPositions(): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    pts.push([Math.cos(a) * 0.055, Math.sin(a) * 0.055]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    pts.push([Math.cos(a) * 0.105, Math.sin(a) * 0.105]);
  }
  return pts;
}

export function MovingHead({ on, dimmer, color, pan, tilt, angle, position }: Props) {
  const lenses = useMemo(lensPositions, []);

  // 각 렌즈의 레이 방향: 바깥 링일수록 줌 반각만큼 바깥쪽으로 기울인다 (부채꼴 퍼짐)
  const rays = useMemo(() => {
    const half = angle / 2;
    return lenses.map(([px, py], i) => {
      const ringFrac = i === 0 ? 0 : i < 7 ? 0.5 : 1;
      const az = Math.atan2(py, px);
      const quat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)),
        d2r(half * ringFrac),
      );
      return {
        lensLocal: [px, FACE_Y, py] as [number, number, number],
        quat,
      };
    });
  }, [lenses, angle]);

  // 개별 레이는 가늘게 유지하고, 줌은 주로 "갈라짐"으로 표현 (실기 Bee-Eye 특성)
  const rayAngle = 2 + angle * 0.1;

  return (
    <group>
      {/* 베이스 (트러스 고정부) */}
      <mesh castShadow>
        <boxGeometry args={[0.32, 0.12, 0.32]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      <mesh position={[0, -0.02, 0.15]}>
        <boxGeometry args={[0.18, 0.06, 0.02]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.3} />
      </mesh>

      {/* Pan 회전 (270°=중앙) */}
      <group rotation-y={d2r(pan - 270)}>
        {/* 요크 양팔 */}
        <mesh position={[-0.19, -0.2, 0]} castShadow>
          <boxGeometry args={[0.04, 0.3, 0.09]} />
          <meshStandardMaterial {...bodyMat} />
        </mesh>
        <mesh position={[0.19, -0.2, 0]} castShadow>
          <boxGeometry args={[0.04, 0.3, 0.09]} />
          <meshStandardMaterial {...bodyMat} />
        </mesh>

        {/* Tilt 회전 (135°=중앙, 빔은 로컬 -Y) */}
        <group rotation-x={d2r(tilt - 135)} position={[0, HEAD_PIVOT_Y, 0]}>
          {/* 헤드 몸통 (짧고 두꺼운 원통) + 뒷캡 */}
          <mesh castShadow>
            <cylinderGeometry args={[0.15, 0.16, 0.24, 24]} />
            <meshStandardMaterial {...bodyMat} />
          </mesh>
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.15, 0.05, 24]} />
            <meshStandardMaterial {...bodyMat} />
          </mesh>

          {/* 전면판 + 19구 렌즈 */}
          <mesh position={[0, -0.121, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.155, 28]} />
            <meshStandardMaterial color="#121214" roughness={0.4} />
          </mesh>
          <group position={[0, -0.125, 0]} rotation-x={Math.PI / 2}>
            {lenses.map(([x, y], i) => (
              <mesh key={i} position={[x, y, 0]}>
                <circleGeometry args={[0.022, 12]} />
                <meshStandardMaterial
                  color="#0a0a0a"
                  emissive={color}
                  emissiveIntensity={on ? Math.max(0.4, dimmer * 2) : 0.03}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>

          {/* 19갈래 멀티 레이 — 표면 음영용 spotLight는 중앙 레이 1개만 */}
          {rays.map((ray, i) => (
            <VolumetricBeam
              key={i}
              on={on}
              dimmer={dimmer}
              color={color}
              angle={rayAngle}
              energyAngle={angle}
              refAngle={REF_ANGLE}
              position={position}
              pan={pan}
              tilt={tilt}
              headOffsetY={HEAD_PIVOT_Y}
              lensLocal={ray.lensLocal}
              lensRadius={0.022}
              rayQuat={ray.quat}
              segments={14}
              intensityScale={0.7}
              showSpotlight={i === 0}
              spotlightAngle={angle}
              castShadow={i === 0}
            />
          ))}
        </group>
      </group>
    </group>
  );
}
