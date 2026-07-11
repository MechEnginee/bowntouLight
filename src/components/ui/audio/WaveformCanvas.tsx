// components/ui/audio/WaveformCanvas.tsx
// peaks + 시간 눈금을 canvas에 그린다. peaks/폭/높이 변할 때만 다시 그림(프레임마다 X).
// 플레이헤드는 여기서 안 그린다(별도 DOM을 rAF로 이동 → canvas 재렌더 불필요).

import { useEffect, useRef } from "react";

const BG = "#101828";
const GRID = "#26324a";
const WAVE = "#4aa0ff";

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** duration/폭에 맞춰 보기 좋은 눈금 간격(초) 선택 */
function tickStep(duration: number, width: number): number {
  const targetPx = 80; // 눈금 하나당 목표 픽셀
  const rough = (duration * targetPx) / Math.max(1, width);
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const s of steps) if (s >= rough) return s;
  return 600;
}

export function WaveformCanvas({
  peaks,
  duration,
  width,
  height,
}: {
  peaks: number[];
  duration: number;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);

    const rulerH = 16;
    const waveTop = rulerH;
    const waveH = height - rulerH;
    const mid = waveTop + waveH / 2;

    // 시간 눈금
    if (duration > 0) {
      const step = tickStep(duration, width);
      ctx.strokeStyle = GRID;
      ctx.fillStyle = "#7f9ac4";
      ctx.font = "9px system-ui, sans-serif";
      ctx.lineWidth = 1;
      for (let t = 0; t <= duration; t += step) {
        const x = (t / duration) * width;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
        ctx.fillText(fmt(t), x + 3, 11);
      }
    }

    // 파형
    if (peaks.length > 0) {
      ctx.fillStyle = WAVE;
      for (let x = 0; x < width; x++) {
        const idx = Math.floor((x / width) * peaks.length);
        const p = peaks[Math.min(peaks.length - 1, idx)] ?? 0;
        const h = Math.max(1, p * (waveH / 2) * 0.92);
        ctx.fillRect(x, mid - h, 1, h * 2);
      }
    }
  }, [peaks, duration, width, height]);

  return <canvas ref={ref} style={{ width, height, display: "block" }} />;
}
