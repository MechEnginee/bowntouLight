// components/fixtures/StrobeLight.tsx  (300W LED Strobe)
// 제어형: 발광면 emissive 토글 + On 시 보조 pointLight.
// (실제 플래시/BPM 동기는 Phase 2)

interface Props {
  on: boolean;
  dimmer: number;
}

export function StrobeLight({ on, dimmer }: Props) {
  return (
    <group>
      {/* 본체 */}
      <mesh castShadow>
        <boxGeometry args={[0.35, 0.25, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 발광면 */}
      <mesh position={[0, 0, 0.06]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshBasicMaterial
          color={on ? "#ffffff" : "#333333"}
          toneMapped={false}
          transparent
          opacity={on ? Math.max(0.25, dimmer) : 1}
        />
      </mesh>
      {on && (
        <pointLight
          position={[0, 0, 0.3]}
          distance={6}
          intensity={dimmer * 3}
          color="#ffffff"
        />
      )}
    </group>
  );
}
