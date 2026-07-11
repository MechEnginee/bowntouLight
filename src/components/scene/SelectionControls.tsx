// components/scene/SelectionControls.tsx
// 선택된 오브젝트(1개 이상)의 중심점에 기즈모를 하나 띄우고,
// 드래그 델타를 선택 전체에 적용한다.
//  - translate: 위치 델타를 전체 이동
//  - rotate:    회전 델타를 각 오브젝트 제자리 회전에 곱함
//  - scale:     배율 델타를 각 오브젝트 스케일에 곱함
// 모드는 스토어 transformMode (1/2/3 키로 전환).
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
  const mode = useSceneStore((s) => s.transformMode);
  const pivotRef = useRef<THREE.Group>(null);
  const lastPos = useRef(new THREE.Vector3());
  const lastQuat = useRef(new THREE.Quaternion());
  const lastScale = useRef(new THREE.Vector3(1, 1, 1));

  // 선택/모드 변경 시 피벗을 중심점으로 재배치하고 회전·스케일 초기화
  useEffect(() => {
    if (!pivotRef.current || selectedIds.length === 0) return;
    const fx = useSceneStore.getState().fixtures;
    const c = new THREE.Vector3();
    let n = 0;
    selectedIds.forEach((id) => {
      const p = fx[id]?.position;
      if (!p) return;
      c.x += p[0];
      c.y += p[1];
      c.z += p[2];
      n++;
    });
    if (n === 0) return;
    c.divideScalar(n);
    pivotRef.current.position.copy(c);
    pivotRef.current.quaternion.identity();
    pivotRef.current.scale.set(1, 1, 1);
    lastPos.current.copy(c);
    lastQuat.current.identity();
    lastScale.current.set(1, 1, 1);
  }, [selectedIds, mode]);

  const handleChange = () => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    const st = useSceneStore.getState();

    if (mode === "translate") {
      const cur = pivot.position;
      const dx = cur.x - lastPos.current.x;
      const dy = cur.y - lastPos.current.y;
      const dz = cur.z - lastPos.current.z;
      if (dx || dy || dz) {
        st.translate(selectedIds, dx, dy, dz);
        lastPos.current.copy(cur);
      }
    } else if (mode === "rotate") {
      const cur = pivot.quaternion;
      if (!cur.equals(lastQuat.current)) {
        const dq = cur.clone().multiply(lastQuat.current.clone().invert());
        st.rotateBy(selectedIds, [dq.x, dq.y, dq.z, dq.w]);
        lastQuat.current.copy(cur);
      }
    } else {
      const cur = pivot.scale;
      const fx = cur.x / (lastScale.current.x || 1);
      const fy = cur.y / (lastScale.current.y || 1);
      const fz = cur.z / (lastScale.current.z || 1);
      if (fx !== 1 || fy !== 1 || fz !== 1) {
        st.scaleBy(selectedIds, [fx || 1, fy || 1, fz || 1]);
        lastScale.current.copy(cur);
      }
    }
  };

  return (
    <>
      <group ref={pivotRef} />
      {selectedIds.length > 0 && pivotRef.current && (
        <TransformControls
          ref={tcRef as never}
          object={pivotRef.current}
          mode={mode}
          size={0.8}
          onObjectChange={handleChange}
        />
      )}
    </>
  );
}
