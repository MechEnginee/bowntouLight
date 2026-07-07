// components/fixtures/Surface.tsx
// 반사 표면(벽/바닥) — 목록에서 추가/삭제/선택하고 기즈모로 이동·회전·크기 조절.
// 빔 스팟이 맺히는 대상(교차 계산은 VolumetricBeam이 스토어에서 직접 읽음).
// 낮은 roughness로 스포트라이트의 반사 광택을 받는다.
// 주의: 뷰포트 클릭 선택은 비활성(raycast null) — 화면 전체를 덮어 마퀴/빈곳클릭을
// 막지 않도록, 선택은 좌측 목록에서 한다.

import * as THREE from "three";
import { SURFACE_SIZE } from "../../config/fixtures.config";

interface Props {
  type: "wall" | "floor";
  color: string;
}

export function Surface({ type, color }: Props) {
  const [w, h] = SURFACE_SIZE[type];
  return (
    <mesh receiveShadow raycast={() => null}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
