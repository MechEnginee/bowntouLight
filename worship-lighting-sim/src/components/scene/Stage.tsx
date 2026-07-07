// components/scene/Stage.tsx
// 무대 기본 환경: 프런트/백 트러스 2개(Box) + 기둥.
// 바닥/뒷벽은 이제 스토어의 반사 표면 오브젝트(floor-1/wall-1)로 관리된다.

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
