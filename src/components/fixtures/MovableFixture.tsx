// components/fixtures/MovableFixture.tsx
// 오브젝트 1개의 시각 + 선택/우클릭On 상호작용.
// 이동/회전/크기 기즈모는 SelectionControls가 선택 전체를 묶어 담당한다.
//  - 좌클릭            → 단일 선택
//  - Ctrl+좌클릭       → 개별 토글
//  - Shift+좌클릭      → 범위 선택
//  - 우클릭            → (선택에 포함돼 있으면) 선택 전체 On, 아니면 이 픽스처만 선택+On
// 벽/바닥(Surface)은 화면을 크게 덮으므로 group에 onClick을 달지 않는다(마퀴 드래그 보호).
// 대신 group.userData.fixtureId 로 표시해 두면 App이 클릭(작은 드래그) 시 직접 선택한다.

import { useSceneStore, selectEffectiveDimmer } from "../../store/scene-store";
import { SURFACE_SIZE } from "../../config/fixtures.config";
import { MovingHead } from "./MovingHead";
import { MiniBeam } from "./MiniBeam";
import { StrobeLight } from "./StrobeLight";
import { Hazer } from "./Hazer";
import { Surface } from "./Surface";
import { SceneLight } from "./SceneLight";
import { Bar, BAR_WIDTH, BAR_HEIGHT } from "./Bar";

export function MovableFixture({ id }: { id: string }) {
  const f = useSceneStore((s) => s.fixtures[id]);
  const selected = useSceneStore((s) => s.selectedIds.includes(id));
  // 최종 출력 밝기(그룹 마스터·페이더 HTP·그랜드마스터·블랙아웃 합성) — 숫자 하나만 구독.
  // f.dimmer는 ControlPanel이 표시/편집하는 "직접(프로그램)" 값으로 그대로 둔다.
  const effectiveDimmer = useSceneStore((s) => selectEffectiveDimmer(s, id));
  // 셰이프/이펙트 엔진이 매 프레임 갱신하는 팬/틸트 오프셋 (없으면 undefined → 리렌더 없음)
  const offset = useSceneStore((s) => s.liveOffsets[id]);

  if (!f) return null;

  const panLive = f.pan + (offset?.pan ?? 0);
  const tiltLive = f.tilt + (offset?.tilt ?? 0);

  // dimmer를 시각화하는 타입은 f.on 대신 effectiveDimmer>0 여부로 점등 판정한다.
  // (블랙아웃·마스터가 0이어도 f.on 자체는 true일 수 있으므로 실제 출력 기준으로 켬/끔을 결정)
  const litOn = effectiveDimmer > 0;

  let visual: JSX.Element | null = null;
  switch (f.type) {
    case "movingHead":
      visual = (
        <MovingHead
          on={litOn}
          dimmer={effectiveDimmer}
          color={f.color}
          pan={panLive}
          tilt={tiltLive}
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
          on={litOn}
          dimmer={effectiveDimmer}
          color={f.color}
          pan={panLive}
          tilt={tiltLive}
          angle={f.angle}
          position={f.position}
          rotation={f.rotation}
          scale={f.scale}
        />
      );
      break;
    case "strobe":
      visual = (
        <StrobeLight on={litOn} dimmer={effectiveDimmer} rate={f.strobeRate} color={f.color} />
      );
      break;
    case "hazer":
      visual = <Hazer on={f.on} />;
      break;
    case "wall":
    case "floor":
      visual = <Surface type={f.type} color={f.color} imageUrl={f.imageUrl} />;
      break;
    case "light":
      visual = <SceneLight on={litOn} dimmer={effectiveDimmer} color={f.color} />;
      break;
    case "bar":
      visual = <Bar color={f.color} />;
      break;
  }

  // 선택 표시 크기: 표면/트러스는 구조 크기에 맞춘 박스, 그 외는 0.7m 큐브
  const isSurface = f.type === "wall" || f.type === "floor";
  const indicatorArgs: [number, number, number] = isSurface
    ? [
        SURFACE_SIZE[f.type as "wall" | "floor"][0] + 0.3,
        SURFACE_SIZE[f.type as "wall" | "floor"][1] + 0.3,
        0.25,
      ]
    : f.type === "bar"
      ? [BAR_WIDTH + 0.5, BAR_HEIGHT + 0.5, 0.5]
      : [0.7, 0.7, 0.7];

  // 표면은 group에 포인터 핸들러를 달지 않는다(마퀴 드래그 보호). App이 userData로 클릭 선택.
  const handlers = isSurface
    ? {}
    : {
        onClick: (e: import("@react-three/fiber").ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const n = e.nativeEvent as MouseEvent;
          const s = useSceneStore.getState();
          if (n.shiftKey) s.rangeSelect(id);
          else if (n.ctrlKey || n.metaKey) s.toggleSelect(id);
          else s.selectSingle(id);
        },
        onContextMenu: (e: import("@react-three/fiber").ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const s = useSceneStore.getState();
          if (s.selectedIds.includes(id)) {
            s.update(s.selectedIds, { on: true });
          } else {
            s.selectSingle(id);
            s.update([id], { on: true });
          }
        },
      };

  return (
    <group
      position={f.position}
      rotation={f.rotation}
      scale={f.scale}
      userData={{ fixtureId: id, isSurface }}
      {...handlers}
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
