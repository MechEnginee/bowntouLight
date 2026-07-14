// components/fixtures/Surface.tsx
// 반사 표면(벽/바닥) — 목록·뷰포트 클릭으로 선택하고 기즈모로 이동·회전·크기 조절.
// 빔 스팟이 맺히는 대상(교차 계산은 VolumetricBeam이 스토어에서 직접 읽음).
// 낮은 roughness로 스포트라이트의 반사 광택을 받는다.
// 클릭 선택 가능(raycast 활성) — 넓어서 마퀴/빈곳클릭 해제는 하늘 영역이나 ESC로.

import * as THREE from "three";
import { SURFACE_SIZE } from "../../config/fixtures.config";
import { useImageTexture } from "../useImageTexture";

interface Props {
  type: "wall" | "floor";
  color: string;
  imageUrl?: string;
}

export function Surface({ type, color, imageUrl }: Props) {
  const [w, h] = SURFACE_SIZE[type];
  const tex = useImageTexture(imageUrl);
  return (
    <mesh receiveShadow>
      <planeGeometry args={[w, h]} />
      {/* 이미지가 있으면 텍스처, 없으면 단색. key로 재료를 갈아끼워 map 토글 시 잔상 방지 */}
      {tex ? (
        <meshStandardMaterial
          key="img"
          map={tex}
          color="#ffffff"
          roughness={0.55}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      ) : (
        <meshStandardMaterial
          key="plain"
          color={color}
          roughness={0.35}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}
