// components/fixtures/ParLight.tsx  (251 MiniBaem)
// 제어형: On/밝기/색을 pointLight + 렌즈 emissive로 표현.

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
}

export function ParLight({ on, dimmer, color }: Props) {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.1, 0.15, 20]} />
        <meshStandardMaterial
          color="#111"
          emissive={color}
          emissiveIntensity={on ? Math.max(0.15, dimmer) : 0.05}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
      <pointLight
        distance={8}
        intensity={on ? dimmer * 4 : 0}
        color={color}
      />
    </group>
  );
}
