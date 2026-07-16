// components/fixtures/SceneLight.tsx
// 배치형 광원 — 목록 추가/선택/기즈모/삭제되는 오브젝트의 "시각 핸들"만 담당.
// 실제 pointLight는 ScenePointLights(라이트 풀)가 낸다 — 광원을 복사해도
// 씬의 조명 개수가 변하지 않아 셰이더 재컴파일 프리즈가 없다(성능).

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
}

export function SceneLight({ on, color }: Props) {
  return (
    <group>
      {/* 시각 핸들 — 발광 구체(클릭 선택 대상) */}
      <mesh>
        <sphereGeometry args={[0.18, 20, 16]} />
        <meshBasicMaterial color={on ? color : "#444455"} toneMapped={false} />
      </mesh>
      {/* 광선 느낌의 외곽 헤일로 */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={on ? 0.18 : 0.04}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
