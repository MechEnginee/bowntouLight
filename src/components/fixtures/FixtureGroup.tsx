// components/fixtures/FixtureGroup.tsx
// 스토어 order를 순회하여 각 픽스처를 MovableFixture로 렌더한다.

import { useSceneStore } from "../../store/scene-store";
import { MovableFixture } from "./MovableFixture";

export function FixtureGroup() {
  const order = useSceneStore((s) => s.order);
  return (
    <group>
      {order.map((id) => (
        <MovableFixture key={id} id={id} />
      ))}
    </group>
  );
}
