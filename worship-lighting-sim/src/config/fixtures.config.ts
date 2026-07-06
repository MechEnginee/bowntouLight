// config/fixtures.config.ts
// 문서 2.1절 "무대 기본 배치 좌표" 기반 24개 픽스처 정의.
// baseAddress(DMX 시작 채널)는 다음 단계(F-05~) 대비로 미리 넣어두되,
// 1차 마일스톤(정적 배치)에서는 아직 사용하지 않는다.

export type FixtureType = "movingHead" | "par" | "strobe" | "hazer";

export interface FixtureConfig {
  id: string;
  type: FixtureType;
  /** 3D 월드 좌표 [x(좌우), y(높이), z(전후)] — 단위: meter */
  position: [number, number, number];
  /** DMX 시작 채널 (0-based). 다음 단계에서 useFrame 반영에 사용 */
  baseAddress: number;
  /** 마운트 위치 라벨 (문서 2.1절) */
  mount: string;
}

/**
 * 좌표 규칙 (문서 2.1절)
 *  - Moving #1~4: 프런트 트러스, Y=4.5, Z=0,    X는 -3.0 ~ +3.0 균등
 *  - Moving #5~8: 백 트러스,   Y=4.5, Z=-2.0,  X는 -3.0 ~ +3.0 균등
 *  - MiniBaem #1~4: 프런트,    Y=4.0, Z=1.0,   X는 -3.5 ~ +3.5 균등
 *  - MiniBaem #5~8: 백,        Y=4.0, Z=-2.5,  X는 -3.5 ~ +3.5 균등
 *  - Strobe #1~8:              Y=3.5, X는 -4.0 ~ +4.0 균등, Z는 트러스 양끝 혼합
 *  - Hazer: 중앙 바닥 (0, 0.5, -1.0)
 */

/** [min,max] 구간을 count개로 균등 분할한 값 배열 */
function linspace(min: number, max: number, count: number): number[] {
  if (count === 1) return [(min + max) / 2];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => +(min + step * i).toFixed(3));
}

const movingFrontX = linspace(-3.0, 3.0, 4);
const movingBackX = linspace(-3.0, 3.0, 4);
const parFrontX = linspace(-3.5, 3.5, 4);
const parBackX = linspace(-3.5, 3.5, 4);
const strobeX = linspace(-4.0, 4.0, 8);

// Moving Head: 채널 7개 (Pan,Tilt,Dim,R,G,B,Gobo) 씩 사용 → 오프셋 7
const MOVING_STRIDE = 7;
// Par: Dim + RGBW = 5채널
const PAR_STRIDE = 5;
// Strobe: Dim + Rate = 2채널
const STROBE_STRIDE = 2;

const movingHeads: FixtureConfig[] = [
  ...movingFrontX.map<FixtureConfig>((x, i) => ({
    id: `moving-${i + 1}`,
    type: "movingHead",
    position: [x, 4.5, 0],
    baseAddress: i * MOVING_STRIDE,
    mount: "프런트 트러스",
  })),
  ...movingBackX.map<FixtureConfig>((x, i) => ({
    id: `moving-${i + 5}`,
    type: "movingHead",
    position: [x, 4.5, -2.0],
    baseAddress: (i + 4) * MOVING_STRIDE,
    mount: "백 트러스",
  })),
];

// Moving Head가 차지한 채널 뒤에서 Par 채널 시작
const PAR_BASE = 8 * MOVING_STRIDE; // 56

const parLights: FixtureConfig[] = [
  ...parFrontX.map<FixtureConfig>((x, i) => ({
    id: `par-${i + 1}`,
    type: "par",
    position: [x, 4.0, 1.0],
    baseAddress: PAR_BASE + i * PAR_STRIDE,
    mount: "프런트 트러스",
  })),
  ...parBackX.map<FixtureConfig>((x, i) => ({
    id: `par-${i + 5}`,
    type: "par",
    position: [x, 4.0, -2.5],
    baseAddress: PAR_BASE + (i + 4) * PAR_STRIDE,
    mount: "백 트러스",
  })),
];

const STROBE_BASE = PAR_BASE + 8 * PAR_STRIDE; // 96

const strobes: FixtureConfig[] = strobeX.map<FixtureConfig>((x, i) => ({
  id: `strobe-${i + 1}`,
  type: "strobe",
  // Z는 트러스 양끝 혼합: 짝/홀로 앞뒤 배치
  position: [x, 3.5, i % 2 === 0 ? 0.5 : -2.5],
  baseAddress: STROBE_BASE + i * STROBE_STRIDE,
  mount: "트러스 양끝",
}));

const HAZER_BASE = STROBE_BASE + 8 * STROBE_STRIDE; // 112

const hazer: FixtureConfig = {
  id: "hazer-1",
  type: "hazer",
  position: [0, 0.5, -1.0],
  baseAddress: HAZER_BASE,
  mount: "무대 뒤 바닥",
};

export const FIXTURES_CONFIG: FixtureConfig[] = [
  ...movingHeads,
  ...parLights,
  ...strobes,
  hazer,
];
