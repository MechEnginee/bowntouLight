// components/fixtures/VolumetricBeam.tsx
// 무빙/미니빔 공용 볼류메트릭 빔.
//  - 잘린 원뿔(truncated cone) + additive 셰이더: 렌즈에서 멀어질수록·가장자리로 갈수록 페이드
//  - 바닥(y=0)·뒷벽(z=-4)과의 교차를 계산해 빔 길이를 결정하고, 맞은 표면에 타원 스팟을 그린다
//  - 에너지 보존: 빔각이 넓어지면 같은 광량이 퍼지므로 밝기가 줄어든다 (refAngle 대비 비율)
// 이 컴포넌트는 헤드의 tilt 그룹 안(로컬 -Y가 빔 방향)에 배치하는 것을 전제로 한다.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const d2r = THREE.MathUtils.degToRad;

const MAX_LENGTH = 25;
const FLOOR_Y = 0;
const WALL_Z = -4;

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
  /** 빔 전체각(도) — 원뿔 반각은 angle/2 */
  angle: number;
  /** 에너지 보존 기준각(도) — 이 각도일 때 배율 1 */
  refAngle: number;
  /** 픽스처 월드 좌표 (MovableFixture group의 position) */
  position: [number, number, number];
  pan: number; // 0..540, 270=중앙
  tilt: number; // 0..270, 135=중앙(수직 아래)
  /** 픽스처 원점 → tilt 피벗의 Y 오프셋 (예: -0.26) */
  headOffsetY: number;
  /** 피벗 → 렌즈까지의 거리(빔 방향) */
  lensOffset: number;
  /** 렌즈(빔 시작) 반지름 */
  lensRadius: number;
  castShadow?: boolean;
}

export function VolumetricBeam({
  on,
  dimmer,
  color,
  angle,
  refAngle,
  position,
  pan,
  tilt,
  headOffsetY,
  lensOffset,
  lensRadius,
  castShadow = false,
}: Props) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

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

  // ─── 월드 공간에서 빔 길이·표면 교차 계산 (모든 입력이 스토어 값 → 렌더 시 순수 계산) ───
  const { length, endRadius, hit, spotQuat, spotScale, spotPos } = useMemo(() => {
    const half = d2r(angle / 2);
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(d2r(tilt - 135), d2r(pan - 270), 0, "YXZ"),
    );
    const dir = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
    const origin = new THREE.Vector3(position[0], position[1] + headOffsetY, position[2])
      .addScaledVector(dir, lensOffset);

    let L = MAX_LENGTH;
    let normal: THREE.Vector3 | null = null;
    if (dir.y < -1e-4) {
      const t = (FLOOR_Y - origin.y) / dir.y;
      if (t > 0 && t < L) {
        L = t;
        normal = new THREE.Vector3(0, 1, 0);
      }
    }
    if (dir.z < -1e-4) {
      const t = (WALL_Z - origin.z) / dir.z;
      if (t > 0 && t < L) {
        L = t;
        normal = new THREE.Vector3(0, 0, 1);
      }
    }
    L = Math.max(L, 0.6);

    const endRadius = lensRadius + Math.tan(half) * L;

    // 스팟 타원: 로컬(빔) 공간에서 표면 법선 기준의 기울어진 원판
    let spotQuat: THREE.Quaternion | null = null;
    let spotScale: [number, number, number] = [1, 1, 1];
    let spotPos: [number, number, number] = [0, -lensOffset - L, 0];
    if (normal) {
      const qInv = q.clone().invert();
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
      const p = new THREE.Vector3(0, -lensOffset - L, 0).addScaledVector(nLocal, 0.02);
      spotPos = [p.x, p.y, p.z];
    }

    return { length: L, endRadius, hit: !!normal, spotQuat, spotScale, spotPos };
  }, [angle, pan, tilt, position, headOffsetY, lensOffset, lensRadius]);

  // ─── 밝기: 에너지 보존 — 넓게 퍼질수록 어두워진다 ───
  const energy = energyScale(angle, refAngle);
  const beamIntensity = Math.min(1.6, 1.1 * dimmer * energy);
  const spotIntensity = Math.min(1.3, 0.9 * dimmer * energy);

  beamMat.uniforms.uColor.value.set(color);
  beamMat.uniforms.uIntensity.value = beamIntensity;
  beamMat.uniforms.uLen.value = length;
  beamMat.uniforms.uEndFade.value = hit ? 0.3 : 0;
  spotMat.uniforms.uColor.value.set(color);
  spotMat.uniforms.uIntensity.value = spotIntensity;

  return (
    <>
      {/* 실제 조명(표면 음영용) — 각도·에너지 동기화 */}
      <primitive object={target} position={[0, -lensOffset - 1, 0]} />
      <spotLight
        ref={lightRef}
        position={[0, -lensOffset, 0]}
        angle={d2r(angle / 2)}
        penumbra={0.4}
        distance={MAX_LENGTH}
        intensity={on ? dimmer * Math.min(energy, 2) * 25 : 0}
        color={color}
        castShadow={castShadow}
      />

      {on && (
        <>
          {/* 볼류메트릭 콘 (렌즈 → 표면/최대거리) */}
          <mesh
            position={[0, -lensOffset - length / 2, 0]}
            material={beamMat}
            raycast={() => null}
          >
            <cylinderGeometry args={[lensRadius, endRadius, length, 40, 1, true]} />
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
    </>
  );
}
