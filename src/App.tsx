// App.tsx — 3D 뷰어 + 좌/우 패널 + 하단 콘솔 패널 + 다중 선택.
// 카메라: 휠=줌 / 좌클릭=없음 / 우클릭 드래그=회전 / 휠클릭 드래그=팬.
// 선택: 픽스처 클릭(Ctrl/Shift 지원) · 빈 공간 좌드래그=마퀴 박스 선택.
// 좌측 목록 항목을 캔버스로 드래그&드롭하면 해당 픽스처를 그 지점으로 이동.
// 단축키: W/E/R=이동/회전/크기 기즈모 · 1~0=페이더 슬롯 Flash · B=블랙아웃
//         Ctrl+C/V=복사/붙여넣기 · Delete=삭제 · Ctrl+Z=실행취소 · Ctrl+Shift+Z 또는 Ctrl+Y=다시실행

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import { Stage } from "./components/scene/Stage";
import { FixtureGroup } from "./components/fixtures/FixtureGroup";
import { SelectionControls } from "./components/scene/SelectionControls";
import { FixtureList } from "./components/ui/FixtureList";
import { ControlPanel } from "./components/ui/ControlPanel";
import { ScenePanel } from "./components/ui/ScenePanel";
import { ConsolePanel } from "./components/ui/ConsolePanel";
import { AudioTimeline } from "./components/ui/audio/AudioTimeline";
import { ResizeHandle } from "./components/ui/ResizeHandle";
import { BAR_WIDTH, BAR_HEIGHT } from "./components/fixtures/Bar";
import { SURFACE_SIZE } from "./config/fixtures.config";
import { useSceneStore, type FixtureRuntime } from "./store/scene-store";
import { useImageTexture } from "./components/useImageTexture";

/** 선택 판정용 로컬 바운딩 박스 크기 [w,h,d] — MovableFixture의 선택 표시 박스와 동일 */
function fixtureBoxSize(f: FixtureRuntime): [number, number, number] {
  if (f.type === "wall" || f.type === "floor") {
    const [w, h] = SURFACE_SIZE[f.type];
    return [w, h, 0.25];
  }
  if (f.type === "bar") return [BAR_WIDTH, BAR_HEIGHT, 0.5];
  return [0.7, 0.7, 0.7];
}

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

/** Scene 배경 — 이미지가 있으면 이미지, 없으면 배경색(RGB). */
function SceneBackground() {
  const [r, g, b] = useSceneStore((s) => s.backgroundColor);
  const bgImage = useSceneStore((s) => s.backgroundImage);
  const tex = useImageTexture(bgImage);
  if (bgImage && tex) return <primitive attach="background" object={tex} />;
  return <color attach="background" args={[r / 255, g / 255, b / 255]} />;
}

/** 개발자 통계 프로브 — Canvas 내부에서 FPS·총 폴리곤 수를 0.25초마다 샘플링해 콜백.
 * 폴리곤은 씬 그래프를 순회해 전체 삼각형 수를 직접 합산(렌더러 통계에 의존하지 않음). */
function StatsProbe({ onSample }: { onSample: (fps: number, tris: number) => void }) {
  const acc = useRef({ frames: 0, time: 0, last: performance.now(), primed: false });
  useFrame(({ scene }) => {
    const a = acc.current;
    const now = performance.now();
    // 마운트 직후 첫 프레임의 큰 공백은 건너뛰어 FPS 왜곡 방지
    if (!a.primed) {
      a.primed = true;
      a.last = now;
      return;
    }
    a.frames += 1;
    a.time += now - a.last;
    a.last = now;
    if (a.time >= 250) {
      let tris = 0;
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const g = mesh.geometry;
        if (!g) return;
        if (g.index) tris += g.index.count / 3;
        else if (g.attributes.position) tris += g.attributes.position.count / 3;
      });
      onSample(Math.round((a.frames * 1000) / a.time), Math.round(tris));
      a.frames = 0;
      a.time = 0;
    }
  });
  return null;
}

export default function App() {
  const transformMode = useSceneStore((s) => s.transformMode);
  const canUndo = useSceneStore((s) => s.past.length > 0);
  const canRedo = useSceneStore((s) => s.future.length > 0);
  const undo = useSceneStore((s) => s.undo);
  const redo = useSceneStore((s) => s.redo);
  const r3f = useRef<RootState | null>(null);
  const tcRef = useRef<THREE.Object3D | null>(null); // TransformControls 인스턴스(.axis로 기즈모 잡는중 판정)
  const marqueeRef = useRef<(Rect & { additive: boolean }) | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ fps: 0, tris: 0 });
  const [showHelp, setShowHelp] = useState(false); // 좌하단 단축키 도움말 토글
  const [maximized, setMaximized] = useState(false); // 3D 뷰 전체화면(패널 숨김)

  // 패널 크기 (좌/우 목록·제어패널 폭, 하단 콘솔 높이) — 경계를 드래그해 조절
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(260);
  const [consoleHeight, setConsoleHeight] = useState(480);
  const [audioHeight, setAudioHeight] = useState(104);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // ─── 전역 키보드 단축키 ───
  // 콘솔 도입(D-6)으로 1~0은 페이더 슬롯 Flash에 배정됐다. 기존 기즈모 모드 단축키는
  // 충돌을 피해 3D 툴 관례인 W(이동)/E(회전)/R(크기)로 이동했다.
  useEffect(() => {
    const DIGIT_TO_SLOT: Record<string, number> = {
      "1": 0, "2": 1, "3": 2, "4": 3, "5": 4,
      "6": 5, "7": 6, "8": 7, "9": 8, "0": 9,
    };

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
      } else if (e.key === "Escape") {
        st.clearSelection();
      } else if (mod && (e.key === "`" || e.code === "Backquote")) {
        // Ctrl+` : 개발자 통계(FPS·폴리곤) 토글
        e.preventDefault();
        setShowStats((v) => !v);
      } else if (!mod && key === "w") {
        st.setTransformMode("translate");
      } else if (!mod && key === "e") {
        st.setTransformMode("rotate");
      } else if (!mod && key === "r") {
        st.setTransformMode("scale");
      } else if (!mod && key === "b") {
        st.toggleBlackout();
      } else if (!mod && !e.repeat && key === "t") {
        // T = 탭 템포 (이펙트 BPM 동기)
        st.tapTempo();
      } else if (!mod && !e.repeat && key in DIGIT_TO_SLOT) {
        // 1~0 = 페이더 슬롯 1~10 Flash (누르는 동안). 키 반복(auto-repeat)은 무시.
        st.setFlashHeld(DIGIT_TO_SLOT[key], true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in DIGIT_TO_SLOT) {
        useSceneStore.getState().setFlashHeld(DIGIT_TO_SLOT[key], false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
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

    // 거의 클릭(작은 박스) → 표면(벽/바닥)이 있으면 선택, 없으면(빈 하늘) 선택 해제
    if (maxX - minX < 4 && maxY - minY < 4) {
      const rectC = st.gl.domElement.getBoundingClientRect();
      const ray = st.raycaster;
      ray.setFromCamera(
        new THREE.Vector2((m.x1 / rectC.width) * 2 - 1, -(m.y1 / rectC.height) * 2 + 1),
        st.camera,
      );
      const hits = ray.intersectObjects(st.scene.children, true);
      let surfaceId: string | null = null;
      for (const h of hits) {
        let n: THREE.Object3D | null = h.object;
        while (n) {
          const ud = n.userData as { fixtureId?: string; isSurface?: boolean };
          if (ud?.fixtureId && ud.isSurface) {
            surfaceId = ud.fixtureId;
            break;
          }
          n = n.parent;
        }
        if (surfaceId) break;
      }
      const s = useSceneStore.getState();
      if (surfaceId) {
        if (m.additive) s.toggleSelect(surfaceId);
        else s.selectSingle(surfaceId);
      } else if (!m.additive) {
        s.clearSelection();
      }
      return;
    }

    // 방향에 따른 선택 방식 (CAD 관례):
    //  - 오른쪽으로 드래그(x1 >= x0) = 포함(window): 오브젝트 전체가 박스 안일 때만
    //  - 왼쪽으로 드래그(x1 <  x0) = 교차(crossing): 박스에 조금이라도 걸치면
    const crossing = m.x1 < m.x0;
    const rect = st.gl.domElement.getBoundingClientRect();
    const fixtures = useSceneStore.getState().fixtures;
    const order = useSceneStore.getState().order;
    const v = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const inside: string[] = [];

    for (const id of order) {
      const f = fixtures[id];
      const [w, h, d] = fixtureBoxSize(f);
      const hx = (w / 2) * f.scale[0];
      const hy = (h / 2) * f.scale[1];
      const hz = (d / 2) * f.scale[2];
      q.setFromEuler(e.set(f.rotation[0], f.rotation[1], f.rotation[2]));

      // 8개 코너를 화면에 투영해 스크린 바운딩 박스 계산
      let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
      let anyFront = false;
      for (let i = 0; i < 8; i++) {
        v.set(
          i & 1 ? hx : -hx,
          i & 2 ? hy : -hy,
          i & 4 ? hz : -hz,
        )
          .applyQuaternion(q)
          .add(new THREE.Vector3(f.position[0], f.position[1], f.position[2]))
          .project(st.camera);
        if (v.z < 1) anyFront = true;
        const sx = (v.x * 0.5 + 0.5) * rect.width;
        const sy = (-v.y * 0.5 + 0.5) * rect.height;
        bMinX = Math.min(bMinX, sx);
        bMaxX = Math.max(bMaxX, sx);
        bMinY = Math.min(bMinY, sy);
        bMaxY = Math.max(bMaxY, sy);
      }
      if (!anyFront) continue;

      const hit = crossing
        ? // 교차: 스크린 사각형이 마퀴와 겹치면
          !(bMaxX < minX || bMinX > maxX || bMaxY < minY || bMinY > maxY)
        : // 포함: 오브젝트 사각형이 마퀴 안에 완전히 들어오면
          bMinX >= minX && bMaxX <= maxX && bMinY >= minY && bMaxY <= maxY;
      if (hit) inside.push(id);
    }
    useSceneStore.getState().setSelection(inside, m.additive);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        background: "#0d0d0d",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 상단 3단: 픽스처 목록 | 3D 뷰 | 제어 패널 (콘솔 패널이 아래를 차지하는 만큼 줄어듦) */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {!maximized && (
        <>
          <FixtureList width={leftWidth} />
          <ResizeHandle
            orientation="vertical"
            onDelta={(d) => setLeftWidth((w) => clamp(w + d, 180, 520))}
          />
        </>
      )}

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
          <SceneBackground />
          <SceneLights />
          {showStats && (
            <StatsProbe onSample={(fps, tris) => setStats({ fps, tris })} />
          )}

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

        {/* 우상단: 실행취소 / 다시실행 + 3D 뷰 최대화/최소화 (태블릿·아이패드용 터치 버튼) */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            gap: 8,
          }}
        >
          {([
            { label: "실행취소", icon: "↶", onClick: undo, enabled: canUndo },
            { label: "다시실행", icon: "↷", onClick: redo, enabled: canRedo },
          ] as const).map((b) => (
            <button
              key={b.label}
              onClick={b.onClick}
              disabled={!b.enabled}
              title={b.label}
              aria-label={b.label}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: b.enabled ? "#3a3a45" : "#26262c",
                color: b.enabled ? "#fff" : "#666",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                fontSize: 20,
                fontWeight: 700,
                cursor: b.enabled ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                touchAction: "manipulation",
              }}
            >
              {b.icon}
            </button>
          ))}
          {/* 3D 뷰 최대화/최소화 토글 */}
          <button
            onClick={() => setMaximized((v) => !v)}
            title={maximized ? "3D 뷰 최소화 (원래 창 크기로)" : "3D 뷰 최대화 (전체 화면)"}
            aria-label="3D 뷰 최대화/최소화"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: maximized ? "#4A90D9" : "#3a3a45",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              touchAction: "manipulation",
            }}
          >
            {maximized ? "🗗" : "🗖"}
          </button>
        </div>

        {/* 개발자 통계 (Ctrl+` 토글) — 우상단 (undo/redo 버튼 아래로) */}
        {showStats && (
          <div
            style={{
              position: "absolute",
              top: 60,
              right: 12,
              color: "#7bff9b",
              font: "12px/1.5 monospace",
              background: "#0a0a0acc",
              border: "1px solid #2a4a2a",
              padding: "6px 10px",
              borderRadius: 6,
              pointerEvents: "none",
              textAlign: "right",
              minWidth: 110,
            }}
          >
            <div>FPS: {stats.fps}</div>
            <div>폴리곤: {stats.tris.toLocaleString()}</div>
          </div>
        )}

        {/* 마퀴 선택 박스 오버레이 — 오른쪽(포함)=파란 실선 / 왼쪽(교차)=초록 점선 */}
        {marquee &&
          (() => {
            const crossing = marquee.x1 < marquee.x0;
            const c = crossing ? "#4dff88" : "#4A90D9";
            return (
              <div
                style={{
                  position: "absolute",
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                  border: `1px ${crossing ? "dashed" : "solid"} ${c}`,
                  background: crossing ? "#4dff8822" : "#4A90D933",
                  pointerEvents: "none",
                }}
              />
            );
          })()}

        {/* 좌상단: 씬 컨트롤 (이동·접기 가능) */}
        <ScenePanel />

        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          {showHelp && (
            <div
              style={{
                color: "#c8c8d0",
                font: "12px/1.6 monospace",
                background: "#1a1a2ee6",
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #2a2a40",
                pointerEvents: "none",
              }}
            >
              휠=줌 · 우클릭=회전 · 휠클릭=이동
              <br />
              클릭/Ctrl/Shift=선택 · 빈곳 드래그=박스선택(→완전포함/←걸침) · 우클릭=On
              <br />
              W/E/R=이동/회전/크기 · Ctrl+C/V=복사/붙여넣기 · Del=삭제
              <br />
              Ctrl+Z=실행취소 · Ctrl+Shift+Z=다시실행 · Esc=선택해제
              <br />
              1~0=페이더 Flash · B=블랙아웃 · T=탭템포 · Space=음원 재생/정지 · Ctrl+`=개발자 통계
              <br />
              <span style={{ color: "#4A90D9" }}>기즈모: {MODE_LABEL[transformMode]}</span>
            </div>
          )}
          <button
            onClick={() => setShowHelp((v) => !v)}
            title={showHelp ? "도움말 닫기" : "단축키 도움말"}
            aria-label="단축키 도움말"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: showHelp ? "#4A90D9" : "#3a3a45",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ?
          </button>
        </div>
      </div>

      {!maximized && (
        <>
          <ResizeHandle
            orientation="vertical"
            onDelta={(d) => setRightWidth((w) => clamp(w - d, 200, 520))}
          />
          <ControlPanel width={rightWidth} />
        </>
      )}
      </div>

      {!maximized && (
        <>
          {/* 3D 뷰와 콘솔 사이: 음원 타임라인(연습용) — 상단 가장자리 드래그로 높이 조절 */}
          <AudioTimeline
            height={audioHeight}
            onHeightChange={(h) => setAudioHeight(clamp(h, 60, 420))}
          />

          <ConsolePanel
            height={consoleHeight}
            onHeightChange={(h) => setConsoleHeight(clamp(h, 120, 640))}
          />
        </>
      )}
    </div>
  );
}
