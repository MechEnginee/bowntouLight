// components/ui/audio/waveform.ts
// 오디오 파일 → 파형 peaks 계산. 로드 시 딱 1번만 실행.
// decodeAudioData는 브라우저 네이티브(대부분 스레드 밖). 계산 후 원본 PCM은 폐기해
// 메모리에는 peaks(수천 개 float)만 남긴다 → 재생 중 지속 비용 0.

const BUCKETS = 1600; // 파형 막대 개수(폭보다 넉넉히 — canvas에서 폭에 맞춰 샘플)

export interface WaveformResult {
  peaks: number[]; // 0..1 정규화된 막대 높이
  duration: number; // 초
}

export async function computeWaveform(file: File): Promise<WaveformResult> {
  const arrayBuf = await file.arrayBuffer();
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    const duration = audioBuf.duration;
    const ch = audioBuf.getChannelData(0); // 1채널만으로 파형 근사
    const total = ch.length;
    const block = Math.max(1, Math.floor(total / BUCKETS));
    // 한 블록당 최대 절대진폭 = 그 구간의 음량. 블록이 크면 내부를 stride로 샘플링(속도).
    const stride = Math.max(1, Math.floor(block / 400));
    const peaks: number[] = new Array(BUCKETS);
    let globalMax = 1e-6;
    for (let i = 0; i < BUCKETS; i++) {
      const start = i * block;
      const end = Math.min(total, start + block);
      let max = 0;
      for (let j = start; j < end; j += stride) {
        const v = Math.abs(ch[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
      if (max > globalMax) globalMax = max;
    }
    // 최댓값 기준 정규화(0..1)
    for (let i = 0; i < BUCKETS; i++) peaks[i] = peaks[i] / globalMax;
    return { peaks, duration };
  } finally {
    // 원본 디코드 버퍼 폐기 — peaks만 남긴다
    void ctx.close();
  }
}
