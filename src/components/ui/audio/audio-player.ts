// components/ui/audio/audio-player.ts
// HTMLAudioElement 싱글턴 래퍼 — 실제 재생/시킹은 브라우저 네이티브 디코더가 담당(메인 스레드 밖).
// currentTime은 여기서 직접 읽는다(스토어에 넣지 않음 → 리렌더 없음).

let el: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

function ensure(): HTMLAudioElement {
  if (!el) el = new Audio();
  return el;
}

/** 파일을 오디오 요소에 로드하고 메타데이터(길이) 준비까지 대기 */
export function loadAudioFile(file: File): Promise<number> {
  const a = ensure();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  a.src = objectUrl;
  a.load();
  return new Promise((resolve, reject) => {
    const onMeta = () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
      resolve(a.duration);
    };
    const onErr = () => {
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("error", onErr);
      reject(new Error("오디오 로드 실패"));
    };
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("error", onErr);
  });
}

export function playAudio(): Promise<void> {
  const a = ensure();
  return a.play();
}
export function pauseAudio(): void {
  el?.pause();
}
export function resetAudio(): void {
  if (el) el.currentTime = 0;
}
export function seekAudio(t: number): void {
  if (el) el.currentTime = Math.max(0, t);
}
export function getAudioTime(): number {
  return el?.currentTime ?? 0;
}
export function getAudioDuration(): number {
  return el?.duration ?? 0;
}
export function isAudioPaused(): boolean {
  return el?.paused ?? true;
}
/** 재생이 끝났을 때 콜백 등록(중복 방지 위해 매번 교체) */
export function setOnEnded(cb: () => void): void {
  const a = ensure();
  a.onended = cb;
}
