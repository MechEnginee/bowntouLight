// App.tsx — 3D 뷰어 + 좌/우 패널 + 다중 선택.
// 카메라: 휠=줌 / 좌클릭=없음 / 우클릭 드래그=회전 / 휠클릭 드래그=팬.
// 선택: 픽스처 클릭(Ctrl/Shift 지원) · 빈 공간 좌드래그=마퀴 박스 선택.
// 좌측 목록 항목을 캔버스로 드래그&드롭하면 해당 픽스처를 그 지점으로 이동.
// 단축키: 1/2/3=이동/회전/크기 기즈모 · Ctrl+C/V=복사/붙여넣기 · Delete=삭제
//         Ctrl+Z=실행취소 · Ctrl+Shift+Z 또는 Ctrl+Y=다시실행

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import { Stage } from "./components/scene/Stage";
import { FixtureGroup } from "./components/fixtures/FixtureGroup";
import { SelectionControls } from "./components/scene/SelectionControls";
import { FixtureList } from "./components/ui/FixtureList";
import { ControlPanel } from "./components/ui/ControlPanel";
import { NumberField } from "./components/ui/NumberField";
import { useSceneStore } from "./store/scene-store";

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MODE_LABEL = {
  translate: "이동",
  rotate: "회전",
  scale: "크기",
} as const;

/** 씬 환경광 — 스토어 sceneBrightness/lightPosition에 연동. Canvas 내부에서 구독해야 리렌더된다. */
function SceneLights() {
  const b = useSceneStore((s) => s.sceneBrightness);
  const lp = useSceneStore((s) => s.lightPosition);
  return (
    <>
      <ambientLight intensity={b} />
      <hemisphereLight args={["#8899aa", "#181820", b]} />
      <directionalLight position={lp} intensity={b} castShadow />
    </>
  );
}

export default function App() {
  const transformMode = useSceneStore((s) => s.transformMode);
  const sceneBrightness = useSceneStore((s) => s.sceneBrightness);
  const setSceneBrightness = useSceneStore((s) => s.setSceneBrightness);
  const lightPosition = useSceneStore((s) => s.lightPosition);
  const setLightPosition = useSceneStore((s) => s.setLightPosition);
  const r3f = useRef<RootState | null>(null);
  const tcRef = useRef<THREE.Object3D | null>(null); // TransformControls 인스턴스(.axis로 기즈모 잡는중 판정)
  const marqueeRef = useRef<(Rect & { additive: boolean }) | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  // ─── 전역 키보드 단축키 ───
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // 입력 필드에서 타이핑 중이면 무시
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      const st = useSceneStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        st.redo();
      } else if (mod && key === "c") {
        if (st.selectedIds.length > 0) {
          e.preventDefault();
          st.copySelection();
        }
      } else if (mod && key === "v") {
        e.preventDefault();
        st.paste();
      } else if (e.key === "Delete") {
        if (st.selectedIds.length > 0) st.removeObjects(st.selectedIds);
      } else if (e.key === "1") {
        st.setTransformMode("translate");
      } else if (e.key === "2") {
        st.setTransformMode("rotate");
      } else if (e.key === "3") {
        st.setTransformMode("scale");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── 좌측 목록 → 캔버스 드롭: 화면 좌표를 픽스처 높이 평면에 투영해 XZ 이동 ───
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const state = r3f.current;
    if (!id || !state) return;
    const fixture = useSceneStore.getState().fixtures[id];
    if (!fixture) return;
    const rect = state.gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, state.camera);
    const y = fixture.position[1];
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) {
      useSceneStore.getState().setPosition(id, [hit.x, y, hit.z]);
      useSceneStore.getState().selectSingle(id);
    }
  };

  // ─── 마퀴(박스) 선택 ───
  // pointerdown 지점이 빈 공간이면 박스 시작. 픽스처/기즈모 위면 각 핸들러에 맡긴다.
  const classifyPoint = (px: number, py: number): "fixture" | "gizmo" | "empty" => {
    const st = r3f.current;
    if (!st) return "empty";
    // 기즈모 축을 잡는 중이면 gizmo
    const tc = tcRef.current as unknown as { axis?: string | null } | null;
    if (tc && tc.axis) return "gizmo";
    const rect = st.gl.domElement.getBoundingClientRect();
    const ray = st.raycaster;
    ray.setFromCamera(
      new THREE.Vector2((px / rect.width) * 2 - 1, -(py / rect.height) * 2 + 1),
      st.camera,
    );
    const hits = ray.intersectObjects(st.scene.children, true);
    for (const h of hits) {
      // TransformControls(기즈모) 히트는 건너뜀
      let n: THREE.Object3D | null = h.object;
      let isTC = false;
      while (n) {
        if (/TransformControls/.test(n.constructor?.name || "")) {
          isTC = true;
          break;
        }
        n = n.parent;
      }
      if (isTC) continue;
      // 픽스처(onClick 핸들러 보유 그룹) 여부
      n = h.object;
      while (n) {
        const handlers = (n as unknown as { __r3f?: { handlers?: Record<string, unknown> } }).__r3f?.handlers;
        if (handlers && handlers.onClick) return "fixture";
        n = n.parent;
      }
      return "empty";
    }
    return "empty";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !r3f.current) return;
    // 마퀴는 실제 3D 캔버스를 직접 눌렀을 때만 시작한다.
    // (좌상단 밝기 슬라이더 같은 HTML 오버레이 위 클릭이면 여기서 중단 →
    //  setPointerCapture로 슬라이더 드래그를 가로채는 버그 방지)
    if (e.target !== r3f.current.gl.domElement) return;
    const rect = r3f.current.gl.domElement.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (classifyPoint(px, py) !== "empty") return; // 픽스처/기즈모는 각자 처리
    marqueeRef.current = {
      x0: px,
      y0: py,
      x1: px,
      y1: py,
      additive: e.shiftKey || e.ctrlKey || e.metaKey,
    };
    setMarquee({ x0: px, y0: py, x1: px, y1: py });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const m = marqueeRef.current;
    if (!m || !r3f.current) return;
    const rect = r3f.current.gl.domElement.getBoundingClientRect();
    m.x1 = e.clientX - rect.left;
    m.y1 = e.clientY - rect.top;
    setMarquee({ x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1 });
  };

  const onPointerUp = () => {
    const m = marqueeRef.current;
    marqueeRef.current = null;
    setMarquee(null);
    const st = r3f.current;
    if (!m || !st) return;

    const minX = Math.min(m.x0, m.x1);
    const maxX = Math.max(m.x0, m.x1);
    const minY = Math.min(m.y0, m.y1);
    const maxY = Math.max(m.y0, m.y1);

    // 거의 클릭(작은 박스) → 빈 공간 클릭 = 선택 해제(추가선택 아닐 때)
    if (maxX - minX < 4 && maxY - minY < 4) {
      if (!m.additive) useSceneStore.getState().clearSelection();
      return;
    }

    const rect = st.gl.domElement.getBoundingClientRect();
    const fixtures = useSceneStore.getState().fixtures;
    const order = useSceneStore.getState().order;
    const v = new THREE.Vector3();
    const inside: string[] = [];
    for (const id of order) {
      const p = fixtures[id].position;
      v.set(p[0], p[1], p[2]).project(st.camera);
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      if (v.z < 1 && sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        inside.push(id);
      }
    }
    useSceneStore.getState().setSelection(inside, m.additive);
  };

  return (
    <div
      style={{ display: "flex", width: "100vw", height: "100vh", background: "#0d0d0d" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <FixtureList />

      <div
        style={{ flex: 1, position: "relative", minWidth: 0 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <Canvas
          shadows
          camera={{ position: [9, 6, 13], fov: 50 }}
          gl={{ antialias: true }}
          onCreated={(state) => (r3f.current = state)}
        >
          <SceneLights />

          <Stage />
          <FixtureGroup />
          <SelectionControls tcRef={tcRef} />

          <Grid
            args={[20, 20]}
            cellColor="#222"
            sectionColor="#4A90D9"
            sectionThickness={1}
            fadeDistance={30}
            position={[0, 0.01, 0]}
          />

          <OrbitControls
            makeDefault
            target={[0, 2.5, 0]}
            enableZoom
            enablePan
            mouseButtons={{
              LEFT: undefined as unknown as THREE.MOUSE,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
          />

          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport axisColors={["#ff4d4d", "#4dff88", "#4d88ff"]} labelColor="white" />
          </GizmoHelper>
        </Canvas>

        {/* 마퀴 선택 박스 오버레이 */}
        {marquee && (
          <div
            style={{
              position: "absolute",
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
              border: "1px solid #4A90D9",
              background: "#4A90D933",
              pointerEvents: "none",
            }}
          />
        )}

        {/* 좌상단: 씬 전역 밝기 + 광원 위치 조절 (인터랙티브) */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            width: 220,
            color: "#c8c8d0",
            font: "12px/1.4 monospace",
            background: "#1a1a2ee6",
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid #2a2a40",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 5,
            }}
          >
            <span style={{ color: "#4A90D9", fontWeight: 700 }}>Scene 밝기</span>
            <NumberField
              value={sceneBrightness * 100}
              onCommit={(v) =>
                setSceneBrightness(Math.max(0, Math.min(200, v)) / 100)
              }
              suffix="%"
              decimals={0}
              width={48}
              align="right"
            />
          </div>
          <input
            type="range"
            min={0}
            max={200}
            value={sceneBrightness * 100}
            onChange={(e) => setSceneBrightness(parseFloat(e.target.value) / 100)}
            style={{ width: "100%", accentColor: "#4A90D9" }}
          />

          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #2a2a40",
            }}
          >
            <div style={{ color: "#7a7a9a", marginBottom: 4 }}>광원 위치 (Light)</div>
            <div style={{ display: "flex", gap: 5 }}>
              {(["X", "Y", "Z"] as const).map((axisLabel, axis) => (
                <div key={axis} style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#555570",
                      textAlign: "center",
                      marginBottom: 1,
                    }}
                  >
                    {axisLabel}
                  </div>
                  <NumberField
                    value={lightPosition[axis]}
                    onCommit={(v) => setLightPosition(axis as 0 | 1 | 2, v)}
                    decimals={1}
                    width="100%"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            top: 158,
            left: 12,
            color: "#c8c8d0",
            font: "12px/1.6 monospace",
            background: "#1a1a2ecc",
            padding: "8px 12px",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        >
          휠=줌 · 우클릭=회전 · 휠클릭=이동
          <br />
          클릭/Ctrl/Shift=선택 · 빈곳 드래그=박스선택 · 우클릭=On
          <br />
          1/2/3=이동/회전/크기 · Ctrl+C/V=복사/붙여넣기 · Del=삭제
          <br />
          Ctrl+Z=실행취소 · Ctrl+Shift+Z=다시실행
          <br />
          <span style={{ color: "#4A90D9" }}>
            기즈모: {MODE_LABEL[transformMode]}
          </span>
        </div>
      </div>

      <ControlPanel />
    </div>
  );
}
