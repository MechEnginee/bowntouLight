// components/fixtures/VolumetricBeam.tsx
// 무빙/미니빔 공용 볼류메트릭 빔(레이 1가닥).
//  - 잘린 원뿔(truncated cone) + additive 셰이더: 렌즈에서 멀어질수록·가장자리로 갈수록 페이드
//  - 스토어의 반사 표면(벽/바닥) 목록과 교차를 계산해 빔 길이를 정하고, 맞은 표면에 타원 스팟을 그린다
//  - 에너지 보존: 빔각(energyAngle)이 넓어지면 같은 광량이 퍼지므로 밝기가 줄어든다
// 이 컴포넌트는 헤드의 tilt 그룹 안(로컬 -Y가 빔 방향)에 배치하는 것을 전제로 한다.
// 워시처럼 여러 갈래로 갈라지는 픽스처는 lensLocal(렌즈 위치) + rayQuat(갈래 방향)을
// 다르게 준 인스턴스를 여러 개 배치한다.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import { useSceneStore, type Vec3 } from "../../store/scene-store";
import { SURFACE_SIZE } from "../../config/fixtures.config";

const d2r = THREE.MathUtils.degToRad;

const MAX_LENGTH = 25;

const IDENTITY_QUAT = new THREE.Quaternion();
const V3_ZERO: Vec3 = [0, 0, 0];
const V3_ONE: Vec3 = [1, 1, 1];

/** 빔각(전체각)이 refAngle에서 벗어날 때의 밝기 배율 — 넓어지면 어두워진다 */
function energyScale(angle: number, refAngle: number): number {
  return THREE.MathUtils.clamp(Math.pow(refAngle / angle, 1.2), 0.35, 3);
}

const beamVertex = /* glsl */ `
  varying float vY;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vY = position.y;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uLen;
  uniform float uEndFade; // 표면에 닿으면 0.3, 허공으로 뻗으면 0
  varying float vY;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // 렌즈(위쪽 y=+uLen/2)에서 0 → 끝에서 1
    float f = clamp((uLen * 0.5 - vY) / uLen, 0.0, 1.0);
    float axial = mix(1.0, uEndFade, pow(f, 0.85));
    // 실루엣 가장자리(법선⊥시선)는 얇게 보이므로 페이드 → 부드러운 빔
    float edge = pow(abs(dot(normalize(vN), normalize(vV))), 0.9);
    float a = uIntensity * axial * edge;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const spotFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = uIntensity * (smoothstep(1.0, 0.3, r) * 0.6 + smoothstep(0.45, 0.0, r) * 0.7);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const spotVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface Props {
  on: boolean;
  dimmer: number;
  color: string;
  /** 이 레이의 전체각(도) — 원뿔 반각은 angle/2 */
  angle: number;
  /** 에너지 보존 계산용 각(도) — 워시는 부채꼴 전체각, 생략 시 angle */
  energyAngle?: number;
  /** 에너지 보존 기준각(도) — 이 각도일 때 배율 1 */
  refAngle: number;
  /** 픽스처 월드 좌표 (MovableFixture group의 position) */
  position: [number, number, number];
  /** 픽스처 루트 회전 (Euler XYZ 라디안) — 기즈모 회전 반영 */
  rootRotation?: Vec3;
  /** 픽스처 루트 스케일 — 균등 스케일 가정 */
  rootScale?: Vec3;
  pan: number; // 0..540, 270=중앙
  tilt: number; // 0..270, 135=중앙(수직 아래)
  /** 픽스처 원점 → tilt 피벗의 Y 오프셋 (예: -0.26) */
  headOffsetY: number;
  /** tilt 그룹 로컬에서의 렌즈(빔 시작점) 위치 */
  lensLocal: [number, number, number];
  /** 렌즈(빔 시작) 반지름 */
  lensRadius: number;
  /** tilt 그룹 로컬에서 -Y를 이 레이 방향으로 돌리는 회전 (기본: 정면) */
  rayQuat?: THREE.Quaternion;
  /** 원뿔 원주 세그먼트 수 — 갈래가 많은 워시는 낮춰서 부담 절감 */
  segments?: number;
  /** 밝기 배율 — 갈래가 많으면 낮춘다 */
  intensityScale?: number;
  /** 표면 음영용 spotLight 포함 여부 (갈래 다발에서는 대표 1개만) */
  showSpotlight?: boolean;
  /** spotLight의 전체각(도) — 워시는 부채꼴 전체를 비추도록 별도 지정 */
  spotlightAngle?: number;
  castShadow?: boolean;
}

export function VolumetricBeam({
  on,
  dimmer,
  color,
  angle,
  energyAngle,
  refAngle,
  position,
  rootRotation = V3_ZERO,
  rootScale = V3_ONE,
  pan,
  tilt,
  headOffsetY,
  lensLocal,
  lensRadius,
  rayQuat = IDENTITY_QUAT,
  segments = 40,
  intensityScale = 1,
  showSpotlight = true,
  spotlightAngle,
  castShadow = false,
}: Props) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const beamGlow = useSceneStore((s) => s.beamGlow);

  useEffect(() => {
    if (lightRef.current) lightRef.current.target = target;
  }, [target]);

  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        uniforms: {
          uColor: { value: new THREE.Color("#ffffff") },
          uIntensity: { value: 0.5 },
          uLen: { value: 5 },
          uEndFade: { value: 0.3 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const spotMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: spotVertex,
        fragmentShader: spotFragment,
        uniforms: {
          uColor: { value: new THREE.Color("#ffffff") },
          uIntensity: { value: 0.5 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => () => {
    beamMat.dispose();
    spotMat.dispose();
  }, [beamMat, spotMat]);

  const [lx, ly, lz] = lensLocal;
  const [rrx, rry, rrz] = rootRotation;
  // 균등 스케일 가정 — 빔 방향/길이 계산은 평균 배율 하나로 처리
  const rootS = Math.max(0.05, (rootScale[0] + rootScale[1] + rootScale[2]) / 3);

  // 반사 표면(벽/바닥) 목록 — 표면이 이동/회전/크기 변경되면 빔 길이·스팟도 갱신
  const surfaces = useSceneStore(
    useShallow((s) =>
      s.order
        .map((id) => s.fixtures[id])
        .filter((f) => f && (f.type === "wall" || f.type === "floor")),
    ),
  );

  // ─── 월드 공간에서 빔 길이·표면 교차 계산 (모든 입력이 스토어 값 → 렌더 시 순수 계산) ───
  const { length, endRadius, hit, spotQuat, spotScale, spotPos } = useMemo(() => {
    const half = d2r(angle / 2);
    // 월드 방향 = 루트 회전 ∘ pan/tilt 회전 ∘ 레이 로컬 회전 ∘ (0,-1,0)
    const qRoot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rrx, rry, rrz),
    );
    const qpt = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(d2r(tilt - 135), d2r(pan - 270), 0, "YXZ"),
    );
    const qTotal = qRoot.clone().multiply(qpt).multiply(rayQuat);
    const dir = new THREE.Vector3(0, -1, 0).applyQuaternion(qTotal);
    // 렌즈 월드 좌표 = 픽스처 위치 + 루트변환(스케일·회전 적용된 로컬 렌즈 오프셋)
    const origin = new THREE.Vector3(lx, ly, lz)
      .applyQuaternion(qpt)
      .add(new THREE.Vector3(0, headOffsetY, 0))
      .multiplyScalar(rootS)
      .applyQuaternion(qRoot)
      .add(new THREE.Vector3(position[0], position[1], position[2]));

    // 모든 반사 표면과 교차 검사 → 가장 가까운 유효 교차를 채택
    let L = MAX_LENGTH;
    let normal: THREE.Vector3 | null = null;
    for (const surf of surfaces) {
      const qs = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(surf.rotation[0], surf.rotation[1], surf.rotation[2]),
      );
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(qs);
      const denom = dir.dot(n);
      if (Math.abs(denom) < 1e-4) continue;
      const center = new THREE.Vector3(...surf.position);
      const t = center.clone().sub(origin).dot(n) / denom;
      if (t < 0.1 || t >= L) continue;
      // 유한 사각형 안인지 로컬 좌표로 확인
      const local = origin
        .clone()
        .addScaledVector(dir, t)
        .sub(center)
        .applyQuaternion(qs.clone().invert());
      const [bw, bh] = SURFACE_SIZE[surf.type as "wall" | "floor"];
      if (
        Math.abs(local.x) > (bw / 2) * surf.scale[0] ||
        Math.abs(local.y) > (bh / 2) * surf.scale[1]
      )
        continue;
      L = t;
      normal = denom < 0 ? n.clone() : n.clone().negate();
    }
    // 렌더링은 픽스처 로컬 공간(루트 스케일 적용 전) 기준 길이로
    L = Math.max(L / rootS, 0.6);

    const endRadius = lensRadius + Math.tan(half) * L;

    // 스팟 타원: 레이 로컬 공간에서 표면 법선 기준의 기울어진 원판
    let spotQuat: THREE.Quaternion | null = null;
    let spotScale: [number, number, number] = [1, 1, 1];
    let spotPos: [number, number, number] = [0, -L, 0];
    if (normal) {
      const qInv = qTotal.clone().invert();
      const nLocal = normal.clone().applyQuaternion(qInv).normalize();
      const dLocal = new THREE.Vector3(0, -1, 0);
      const cos = Math.abs(dLocal.dot(nLocal));
      // 빔의 표면 투영 방향 = 타원의 장축
      const proj = dLocal.clone().addScaledVector(nLocal, -dLocal.dot(nLocal));
      const x =
        proj.lengthSq() > 1e-6
          ? proj.normalize()
          : new THREE.Vector3(1, 0, 0).addScaledVector(nLocal, -nLocal.x).normalize();
      const y = new THREE.Vector3().crossVectors(nLocal, x);
      const m = new THREE.Matrix4().makeBasis(x, y, nLocal);
      spotQuat = new THREE.Quaternion().setFromRotationMatrix(m);
      const rMajor = endRadius / THREE.MathUtils.clamp(cos, 0.18, 1);
      spotScale = [rMajor, endRadius, 1];
      // Z-파이팅 방지: 표면 법선 방향으로 살짝 띄운다
      const p = new THREE.Vector3(0, -L, 0).addScaledVector(nLocal, 0.02);
      spotPos = [p.x, p.y, p.z];
    }

    return { length: L, endRadius, hit: !!normal, spotQuat, spotScale, spotPos };
  }, [angle, pan, tilt, position, headOffsetY, lx, ly, lz, lensRadius, rayQuat, rrx, rry, rrz, rootS, surfaces]);

  // ─── 밝기: 에너지 보존 — 넓게 퍼질수록 어두워진다 ───
  // beamGlow(전역): 반짝이는 볼류메트릭 글로우 세기 배율(클램프 후 곱해 1 이상도 허용)
  const energy = energyScale(energyAngle ?? angle, refAngle);
  const beamIntensity = Math.min(1.6, 1.1 * dimmer * energy * intensityScale) * beamGlow;
  const spotIntensity = Math.min(1.3, 0.9 * dimmer * energy * intensityScale) * beamGlow;

  beamMat.uniforms.uColor.value.set(color);
  beamMat.uniforms.uIntensity.value = beamIntensity;
  beamMat.uniforms.uLen.value = length;
  beamMat.uniforms.uEndFade.value = hit ? 0.3 : 0;
  spotMat.uniforms.uColor.value.set(color);
  spotMat.uniforms.uIntensity.value = spotIntensity;

  return (
    <group position={lensLocal} quaternion={rayQuat}>
      {/* 실제 조명(표면 음영용) — 각도·에너지 동기화 */}
      {showSpotlight && (
        <>
          <primitive object={target} position={[0, -1, 0]} />
          <spotLight
            ref={lightRef}
            position={[0, 0, 0]}
            angle={d2r((spotlightAngle ?? angle) / 2)}
            penumbra={0.4}
            distance={MAX_LENGTH}
            intensity={on ? dimmer * Math.min(energy, 2) * 25 : 0}
            color={color}
            castShadow={castShadow}
          />
        </>
      )}

      {on && (
        <>
          {/* 볼류메트릭 콘 (렌즈 → 표면/최대거리) */}
          <mesh position={[0, -length / 2, 0]} material={beamMat} raycast={() => null}>
            <cylinderGeometry args={[lensRadius, endRadius, length, segments, 1, true]} />
          </mesh>

          {/* 표면 스팟 (바닥/뒷벽) */}
          {hit && spotQuat && (
            <mesh
              position={spotPos}
              quaternion={spotQuat}
              scale={spotScale}
              material={spotMat}
              raycast={() => null}
            >
              <circleGeometry args={[1, 40]} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
