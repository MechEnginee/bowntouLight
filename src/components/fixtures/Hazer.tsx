// components/fixtures/Hazer.tsx  (Generic Hazer)
// 제어형: On 시 배출구 발광. 실제 연기 파티클은 Phase 2.

interface Props {
  on: boolean;
}

export function Hazer({ on }: Props) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.6, 0.35, 0.4]} />
        <meshStandardMaterial color="#222" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* 배출구 그릴 (On 시 은은히 발광) */}
      <mesh position={[0, 0.05, 0.21]}>
        <planeGeometry args={[0.4, 0.15]} />
        <meshStandardMaterial
          color="#444"
          emissive="#88aaff"
          emissiveIntensity={on ? 0.6 : 0}
        />
      </mesh>
    </group>
  );
}
