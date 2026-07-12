// store/audio-store.ts
// 오디오 타임라인 전용 zustand 스토어 — 3D/콘솔 스토어와 분리.
// 성능 원칙: 재생 위치(currentTime)는 여기에 넣지 않는다(60fps 리렌더 방지).
//   플레이헤드는 AudioTimeline이 ref+rAF로 DOM을 직접 이동시킨다.
//   여기에는 자주 안 바뀌는 상태(파일/파형/마커/재생여부/접힘)만 둔다.

import { create } from "zustand";

export interface AudioMarker {
  id: string;
  time: number; // 초
  text: string;
  color?: string;
}

function mid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface AudioState {
  fileName: string | null;
  duration: number; // 초 (실제 로드된 음원 길이)
  peaks: number[]; // 0..1 파형 막대(로드 시 1회 계산, 메모리에만 — .btw 미저장)
  loaded: boolean; // 오디오 실제 로드/디코드 완료
  analyzing: boolean; // 파형 분석 중
  error: string | null;
  playing: boolean; // 재생 여부(버튼 UI용 — 프레임마다 안 바뀜)
  collapsed: boolean;
  markers: AudioMarker[];

  /** 씬에서 복원된 기대 음원 길이(초) — 재링크 시 동일 음원 판정용. 0=없음 */
  savedDuration: number;
  /** 씬 복원 후 원본 음원을 다시 찾아야 하는 상태 → "파일 찾기" 팝업 표시 */
  awaitingRelink: boolean;

  setAnalyzing: (b: boolean) => void;
  setError: (msg: string | null) => void;
  /** 음원 로드 완료(마커 유지 — 정상 로드/길이 일치 재링크) */
  setLoaded: (fileName: string, duration: number, peaks: number[]) => void;
  /** 다른 음원으로 교체(마커 폐기 — 길이 불일치 후 "예") */
  replaceAudio: (fileName: string, duration: number, peaks: number[]) => void;
  setPlaying: (b: boolean) => void;
  toggleCollapsed: () => void;
  clearAudio: () => void;

  addMarker: (time: number, text: string) => void;
  updateMarker: (id: string, patch: Partial<Omit<AudioMarker, "id">>) => void;
  removeMarker: (id: string) => void;

  /** .btw 불러오기: 파일명+길이+마커 복원(오디오 원본은 사용자가 다시 로드) */
  restoreFromScene: (fileName: string | null, duration: number, markers: AudioMarker[]) => void;
  /** "파일 찾기" 팝업 닫기(나중에) — 재링크 대기만 해제, 저장정보는 유지 */
  dismissRelink: () => void;
}

export const useAudioStore = create<AudioState>()((set) => ({
  fileName: null,
  duration: 0,
  peaks: [],
  loaded: false,
  analyzing: false,
  error: null,
  playing: false,
  collapsed: false,
  markers: [],
  savedDuration: 0,
  awaitingRelink: false,

  setAnalyzing: (b) => set({ analyzing: b, error: b ? null : undefined }),
  setError: (msg) => set({ error: msg, analyzing: false }),
  setLoaded: (fileName, duration, peaks) =>
    set({
      fileName,
      duration,
      peaks,
      loaded: true,
      analyzing: false,
      error: null,
      playing: false,
      savedDuration: 0,
      awaitingRelink: false,
    }),
  replaceAudio: (fileName, duration, peaks) =>
    set({
      fileName,
      duration,
      peaks,
      loaded: true,
      analyzing: false,
      error: null,
      playing: false,
      markers: [], // 다른 음원 → 기존 메모 폐기
      savedDuration: 0,
      awaitingRelink: false,
    }),
  setPlaying: (b) => set({ playing: b }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  clearAudio: () =>
    set({
      fileName: null,
      duration: 0,
      peaks: [],
      loaded: false,
      analyzing: false,
      error: null,
      playing: false,
      markers: [],
      savedDuration: 0,
      awaitingRelink: false,
    }),

  addMarker: (time, text) =>
    set((s) => ({
      markers: [...s.markers, { id: mid(), time, text }].sort((a, b) => a.time - b.time),
    })),
  updateMarker: (id, patch) =>
    set((s) => ({
      markers: s.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeMarker: (id) => set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),

  restoreFromScene: (fileName, duration, markers) =>
    set({
      fileName,
      savedDuration: duration > 0 ? duration : 0,
      markers: [...markers].sort((a, b) => a.time - b.time),
      // 오디오 원본은 재로드 필요 — 파형/재생 상태는 리셋
      duration: 0,
      peaks: [],
      loaded: false,
      analyzing: false,
      playing: false,
      error: null,
      // 저장된 음원 파일명이 있으면 "파일 찾기" 팝업을 띄운다
      awaitingRelink: !!fileName,
    }),

  dismissRelink: () => set({ awaitingRelink: false }),
}));
