// components/fixtures/MovableFixture.tsx
// 오브젝트 1개의 시각 + 선택/우클릭On 상호작용.
// 이동/회전/크기 기즈모는 SelectionControls가 선택 전체를 묶어 담당한다.
//  - 좌클릭            → 단일 선택
//  - Ctrl+좌클릭       → 개별 토글
//  - Shift+좌클릭      → 범위 선택
//  - 우클릭            → (선택에 포함돼 있으면) 선택 전체 On, 아니면 이 픽스처만 선택+On
// 벽/바닥(Surface)은 뷰포트 클릭 불가(마퀴 보호) — 좌측 목록에서 선택한다.

import { useSceneStore } from "../../store/scene-store";
import { SURFACE_SIZE } from "../../config/fixtures.config";
import { MovingHead } from "./MovingHead";
import { MiniBeam } from "./MiniBeam";
import { StrobeLight } from "./StrobeLight";
import { Hazer } from "./Hazer";
import { Surface } from "./Surface";

export function MovableFixture({ id }: { id: string }) {
  const f = useSceneStore((s) => s.fixtures[id]);
  const selected = useSceneStore((s) => s.selectedIds.includes(id));

  if (!f) return null;

  let visual: JSX.Element | null = null;
  switch (f.type) {
    case "movingHead":
      visual = (
        <MovingHead
          on={f.on}
          dimmer={f.dimmer}
          color={f.color}
          pan={f.pan}
          tilt={f.tilt}
          angle={f.angle}
          position={f.position}
          rotation={f.rotation}
          scale={f.scale}
        />
      );
      break;
    case "par":
      visual = (
        <MiniBeam
          on={f.on}
          dimmer={f.dimmer}
          color={f.color}
          pan={f.pan}
          tilt={f.tilt}
          angle={f.angle}
          position={f.position}
          rotation={f.rotation}
          scale={f.scale}
        />
      );
      break;
    case "strobe":
      visual = <StrobeLight on={f.on} dimmer={f.dimmer} rate={f.strobeRate} />;
      break;
    case "hazer":
      visual = <Hazer on={f.on} />;
      break;
    case "wall":
    case "floor":
      visual = <Surface type={f.type} color={f.color} />;
      break;
  }

  // 선택 표시 크기: 표면은 판 크기에 맞춘 얇은 박스, 그 외는 0.7m 큐브
  const isSurface = f.type === "wall" || f.type === "floor";
  const indicatorArgs: [number, number, number] = isSurface
    ? [
        SURFACE_SIZE[f.type as "wall" | "floor"][0] + 0.3,
        SURFACE_SIZE[f.type as "wall" | "floor"][1] + 0.3,
        0.25,
      ]
    : [0.7, 0.7, 0.7];

  return (
    <group
      position={f.position}
      rotation={f.rotation}
      scale={f.scale}
      onClick={(e) => {
        e.stopPropagation();
        const n = e.nativeEvent as MouseEvent;
        const s = useSceneStore.getState();
        if (n.shiftKey) s.rangeSelect(id);
        else if (n.ctrlKey || n.metaKey) s.toggleSelect(id);
        else s.selectSingle(id);
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        const s = useSceneStore.getState();
        if (s.selectedIds.includes(id)) {
          s.update(s.selectedIds, { on: true });
        } else {
          s.selectSingle(id);
          s.update([id], { on: true });
        }
      }}
    >
      {visual}
      {selected && (
        <mesh raycast={() => null}>
          <boxGeometry args={indicatorArgs} />
          <meshBasicMaterial color="#4A90D9" wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}
