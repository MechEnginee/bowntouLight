// components/scene/Stage.tsx
// 무대 기본 환경: 바닥(Plane) + 뒷벽 + 프런트/백 트러스 2개(Box).
// 문서 2.1절 좌표계 기준 — 트러스 높이/깊이를 픽스처 배치 높이와 맞춘다.

const FLOOR_SIZE = 20;
const STAGE_WIDTH = 10; // 트러스 가로 길이

/** 가로로 뻗은 트러스 하나 (지정 높이/깊이) */
function Truss({ y, z }: { y: number; z: number }) {
  return (
    <mesh position={[0, y, z]} castShadow receiveShadow>
      <boxGeometry args={[STAGE_WIDTH, 0.2, 0.2]} />
      <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
    </mesh>
  );
}

/** 트러스를 받치는 수직 기둥 */
function TrussLeg({ x, z, height }: { x: number; z: number; height: number }) {
  return (
    <mesh position={[x, height / 2, z]} castShadow>
      <boxGeometry args={[0.15, height, 0.15]} />
      <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.5} />
    </mesh>
  );
}

export function Stage() {
  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial color="#151515" roughness={0.9} />
      </mesh>

      {/* 뒷벽 */}
      <mesh position={[0, 4, -4]} receiveShadow>
        <planeGeometry args={[FLOOR_SIZE, 8]} />
        <meshStandardMaterial color="#0d0d12" roughness={1} />
      </mesh>

      {/* 프런트 트러스 (Z=0, Moving 4.5 / Par 4.0 가 매달림) */}
      <Truss y={4.7} z={0} />
      <TrussLeg x={-STAGE_WIDTH / 2} z={0} height={4.7} />
      <TrussLeg x={STAGE_WIDTH / 2} z={0} height={4.7} />

      {/* 백 트러스 (Z=-2.3 부근) */}
      <Truss y={4.7} z={-2.3} />
      <TrussLeg x={-STAGE_WIDTH / 2} z={-2.3} height={4.7} />
      <TrussLeg x={STAGE_WIDTH / 2} z={-2.3} height={4.7} />
    </group>
  );
}
