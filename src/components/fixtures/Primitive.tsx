// components/fixtures/Primitive.tsx
// 사용자가 추가하는 기본 도형(큐브/원통/구). 색 또는 이미지 텍스처로 렌더.
// 크기는 MovableFixture group의 scale로 조절(기즈모 3). 로컬 기본 크기는 PRIMITIVE_BOX와 맞춘다.

import * as THREE from "three";
import type { PrimitiveType } from "../../config/fixtures.config";
import { useImageTexture } from "../useImageTexture";

interface Props {
  kind: PrimitiveType;
  color: string;
  imageUrl?: string;
  roughness?: number;
}

export function Primitive({ kind, color, imageUrl, roughness }: Props) {
  const tex = useImageTexture(imageUrl);
  return (
    <mesh castShadow receiveShadow>
      {kind === "cube" && <boxGeometry args={[1, 1, 1]} />}
      {kind === "cylinder" && <cylinderGeometry args={[0.5, 0.5, 1.5, 40]} />}
      {kind === "sphere" && <sphereGeometry args={[0.6, 40, 28]} />}
      {tex ? (
        <meshStandardMaterial key="img" map={tex} color="#ffffff" roughness={roughness ?? 0.55} metalness={0.1} />
      ) : (
        <meshStandardMaterial key="plain" color={color} roughness={roughness ?? 0.45} metalness={0.15} side={THREE.FrontSide} />
      )}
    </mesh>
  );
}
