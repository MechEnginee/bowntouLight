// components/scene/SelectionControls.tsx
// 선택된 픽스처(1개 이상)의 중심점에 이동 기즈모를 하나 띄우고,
// 드래그 델타를 선택 전체에 적용해 함께 이동시킨다.
// tcRef 는 App의 마퀴 판정(기즈모 잡는 중인지)에서 참조한다.

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { TransformControls } from "@react-three/drei";
import { useSceneStore } from "../../store/scene-store";

export function SelectionControls({
  tcRef,
}: {
  tcRef: MutableRefObject<THREE.Object3D | null>;
}) {
  const selectedIds = useSceneStore((s) => s.selectedIds);
  const pivotRef = useRef<THREE.Group>(null);
  const last = useRef(new THREE.Vector3());

  // 선택 변경 시 중심점으로 피벗 재배치
  useEffect(() => {
    if (!pivotRef.current || selectedIds.length === 0) return;
    const fx = useSceneStore.getState().fixtures;
    const c = new THREE.Vector3();
    selectedIds.forEach((id) => {
      const p = fx[id].position;
      c.x += p[0];
      c.y += p[1];
      c.z += p[2];
    });
    c.divideScalar(selectedIds.length);
    pivotRef.current.position.copy(c);
    last.current.copy(c);
  }, [selectedIds]);

  return (
    <>
      <group ref={pivotRef} />
      {selectedIds.length > 0 && pivotRef.current && (
        <TransformControls
          ref={tcRef as never}
          object={pivotRef.current}
          mode="translate"
          size={0.8}
          onObjectChange={() => {
            const cur = pivotRef.current!.position;
            const dx = cur.x - last.current.x;
            const dy = cur.y - last.current.y;
            const dz = cur.z - last.current.z;
            if (dx || dy || dz) {
              useSceneStore.getState().translate(selectedIds, dx, dy, dz);
              last.current.set(cur.x, cur.y, cur.z);
            }
          }}
        />
      )}
    </>
  );
}
