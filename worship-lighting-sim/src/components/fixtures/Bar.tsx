// components/fixtures/Bar.tsx
// 트러스 바(설치용 기둥+가로바 구조물) — 조명을 매다는 골포스트형 프레임.
//  - 상단 가로 빔 + 좌우 수직 기둥(+ 바닥 발판). 발광하지 않는 구조물.
//  - color = 프레임 재질색. 크기는 scale로 조절.
// 그룹 원점은 프레임 중심(y=0이 중앙). 위치 y = 높이/2 이면 발판이 바닥(y=0)에 닿는다.

interface Props {
  color: string;
}

export const BAR_WIDTH = 10; // 기본 가로 폭
export const BAR_HEIGHT = 4.7; // 기본 높이
const T = 0.2; // 빔 두께
const LEG = 0.16; // 기둥 두께

export function Bar({ color }: Props) {
  const mat = { color, metalness: 0.6, roughness: 0.45 };
  const halfW = BAR_WIDTH / 2;
  const halfH = BAR_HEIGHT / 2;
  return (
    <group>
      {/* 상단 가로 빔 */}
      <mesh position={[0, halfH, 0]} castShadow receiveShadow>
        <boxGeometry args={[BAR_WIDTH + T, T, T]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* 좌우 수직 기둥 */}
      <mesh position={[-halfW, 0, 0]} castShadow>
        <boxGeometry args={[LEG, BAR_HEIGHT, LEG]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[halfW, 0, 0]} castShadow>
        <boxGeometry args={[LEG, BAR_HEIGHT, LEG]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* 바닥 발판 */}
      <mesh position={[-halfW, -halfH + 0.02, 0]} castShadow>
        <boxGeometry args={[0.5, 0.04, 0.5]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[halfW, -halfH + 0.02, 0]} castShadow>
        <boxGeometry args={[0.5, 0.04, 0.5]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}
