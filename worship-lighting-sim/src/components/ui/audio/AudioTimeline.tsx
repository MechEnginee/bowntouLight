// components/ui/audio/AudioTimeline.tsx
// 콘솔과 3D 뷰 사이의 접이식 오디오 타임라인 바.
//  - mp3/아이폰(.m4a) 로드 → 파형+시간눈금 표시
//  - ▶/⏸/⏮ 재생 제어, 클릭=시킹
//  - 재생 중 플레이헤드가 ref+rAF로 이동(React 상태 X → 리렌더/성능 부담 없음)
//  - 바 우클릭 = 그 시점에 메모 마커 추가, 마커 우클릭 = 편집/삭제, 마커 클릭 = 점프

import { useEffect, useRef, useState } from "react";
import { useAudioStore } from "../../../store/audio-store";
import { WaveformCanvas } from "./WaveformCanvas";
import { computeWaveform } from "./waveform";
import { ResizeHandle } from "../ResizeHandle";
import {
  loadAudioFile,
  playAudio,
  pauseAudio,
  resetAudio,
  seekAudio,
  getAudioTime,
  setOnEnded,
} from "./audio-player";

const HEADER_H = 28;
export const AUDIO_BODY_DEFAULT = 104; // 본문(파형) 기본 높이 — App 초기값

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioTimeline({
  height = AUDIO_BODY_DEFAULT,
  onHeightChange,
}: {
  height?: number;
  onHeightChange?: (h: number) => void;
}) {
  const bodyH = height; // 파형 본문 높이(리사이즈로 조절)
  const {
    fileName,
    duration,
    peaks,
    loaded,
    analyzing,
    error,
    playing,
    collapsed,
    markers,
  } = useAudioStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const info = useRef({ width: 0, duration: 0 });
  info.current = { width, duration };

  // 폭 측정(리사이즈 시에만) — canvas 재렌더 트리거
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed, loaded]);

  // 재생 종료 콜백
  useEffect(() => {
    setOnEnded(() => {
      useAudioStore.getState().setPlaying(false);
      movePlayhead(0);
    });
  }, []);

  const movePlayhead = (t: number) => {
    const { width: w, duration: d } = info.current;
    if (playheadRef.current && d > 0) {
      playheadRef.current.style.transform = `translateX(${(t / d) * w}px)`;
    }
  };

  // 재생 중에만 도는 rAF — 플레이헤드 DOM만 이동(스토어/리렌더 없음)
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const loop = () => {
      movePlayhead(getAudioTime());
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const handleFile = async (file: File) => {
    const store = useAudioStore.getState();
    store.setAnalyzing(true);
    try {
      const metaDur = await loadAudioFile(file);
      const { peaks: pk, duration: d } = await computeWaveform(file);
      store.setLoaded(file.name, d || metaDur, pk);
      movePlayhead(0);
    } catch (e) {
      store.setError(e instanceof Error ? e.message : "오디오를 불러올 수 없습니다");
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  };

  const togglePlay = async () => {
    const store = useAudioStore.getState();
    if (!loaded) return;
    if (playing) {
      pauseAudio();
      store.setPlaying(false);
    } else {
      try {
        await playAudio();
        store.setPlaying(true);
      } catch {
        /* 사용자 제스처 필요 등 — 무시 */
      }
    }
  };

  const doReset = () => {
    resetAudio();
    movePlayhead(0);
  };

  const timeFromX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return (x / rect.width) * duration;
  };

  const onTrackClick = (e: React.MouseEvent) => {
    if (!loaded) return;
    const t = timeFromX(e.clientX);
    seekAudio(t);
    movePlayhead(t);
  };

  const onTrackContext = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!loaded) return;
    const t = timeFromX(e.clientX);
    const text = window.prompt(`${fmt(t)} 지점 메모`, "");
    if (text && text.trim()) useAudioStore.getState().addMarker(t, text.trim());
  };

  const editMarker = (e: React.MouseEvent, id: string, cur: string) => {
    e.preventDefault();
    e.stopPropagation();
    const text = window.prompt("메모 편집 (비우면 삭제)", cur);
    if (text === null) return;
    if (text.trim()) useAudioStore.getState().updateMarker(id, { text: text.trim() });
    else useAudioStore.getState().removeMarker(id);
  };

  const jumpToMarker = (e: React.MouseEvent, t: number) => {
    e.stopPropagation();
    seekAudio(t);
    movePlayhead(t);
  };

  return (
    <div
      style={{
        flex: `0 0 ${collapsed ? HEADER_H : HEADER_H + bodyH}px`,
        display: "flex",
        flexDirection: "column",
        background: "#0c1220",
        borderTop: "1px solid #223049",
        borderBottom: "1px solid #223049",
        overflow: "hidden",
      }}
    >
      {/* 상단 가장자리 드래그 = 타임라인 높이 조절 (펼쳐진 상태에서만) */}
      {!collapsed && onHeightChange && (
        <ResizeHandle orientation="horizontal" onDelta={(d) => onHeightChange(bodyH - d)} />
      )}

      {/* 헤더: 접기 + 파일 + 컨트롤 */}
      <div
        style={{
          height: HEADER_H,
          flex: `0 0 ${HEADER_H}px`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          background: "linear-gradient(180deg, #16203a, #101828)",
        }}
      >
        <button
          onClick={() => useAudioStore.getState().toggleCollapsed()}
          style={hdrBtn}
          title={collapsed ? "타임라인 펼치기" : "타임라인 접기"}
        >
          {collapsed ? "▲" : "▼"}
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#9ab8e0" }}>🎵 음원 타임라인</span>

        {loaded && (
          <>
            <button onClick={togglePlay} style={ctrlBtn} title={playing ? "일시정지" : "재생"}>
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={doReset} style={ctrlBtn} title="처음으로">
              ⏮
            </button>
          </>
        )}

        <span style={{ fontSize: 10, color: "#6b7fa6", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {analyzing ? "분석 중…" : error ? `⚠ ${error}` : fileName ? `${fileName}${loaded ? ` · ${fmt(duration)}` : " · 다시 로드 필요"}` : "음원(mp3·m4a)을 불러오세요"}
        </span>

        <label style={{ ...ctrlBtn, cursor: "pointer" }} title="음원 불러오기">
          📂 로드
          <input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav" onChange={onPickFile} style={{ display: "none" }} />
        </label>
        {fileName && (
          <button onClick={() => useAudioStore.getState().clearAudio()} style={hdrBtn} title="닫기">
            ✕
          </button>
        )}
      </div>

      {/* 본문: 파형 + 마커 + 플레이헤드 */}
      {!collapsed && (
        <div style={{ flex: `0 0 ${bodyH}px`, position: "relative", padding: 6 }}>
          {loaded ? (
            <div
              ref={trackRef}
              onClick={onTrackClick}
              onContextMenu={onTrackContext}
              style={{ position: "relative", width: "100%", height: bodyH - 12, cursor: "text", userSelect: "none" }}
            >
              <WaveformCanvas peaks={peaks} duration={duration} width={width} height={bodyH - 12} />

              {/* 마커 */}
              {duration > 0 &&
                markers.map((m) => {
                  const left = (m.time / duration) * width;
                  return (
                    <div
                      key={m.id}
                      onClick={(e) => jumpToMarker(e, m.time)}
                      onContextMenu={(e) => editMarker(e, m.id, m.text)}
                      title={`${fmt(m.time)} · ${m.text} (클릭=이동, 우클릭=편집)`}
                      style={{
                        position: "absolute",
                        top: 0,
                        left,
                        transform: "translateX(-50%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        zIndex: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8.5,
                          color: "#0c1220",
                          background: m.color ?? "#ffd24a",
                          padding: "0 3px",
                          borderRadius: 2,
                          whiteSpace: "nowrap",
                          maxWidth: 90,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontWeight: 700,
                        }}
                      >
                        {m.text}
                      </span>
                      <div style={{ width: 1, height: bodyH - 24, background: m.color ?? "#ffd24a", opacity: 0.7 }} />
                    </div>
                  );
                })}

              {/* 플레이헤드 (rAF로 transform 이동) */}
              <div
                ref={playheadRef}
                data-testid="playhead"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 2,
                  height: bodyH - 12,
                  background: "#ff5a4a",
                  boxShadow: "0 0 6px #ff5a4a",
                  pointerEvents: "none",
                  zIndex: 4,
                  willChange: "transform",
                }}
              />
            </div>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              style={{
                width: "100%",
                height: bodyH - 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px dashed #2a3a58",
                borderRadius: 4,
                color: "#5a6a88",
                fontSize: 11,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              {analyzing
                ? "분석 중…"
                : fileName
                  ? `이 씬의 메모 ${markers.length}개 · "${fileName}"을(를) 다시 로드하면 표시됩니다`
                  : "여기로 음원 파일을 끌어다 놓거나 우측 상단 [📂 로드]"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const hdrBtn: React.CSSProperties = {
  border: "1px solid #2a3a58",
  background: "#1b2338",
  color: "#9ab8e0",
  borderRadius: 3,
  fontSize: 10,
  padding: "2px 6px",
  cursor: "pointer",
};
const ctrlBtn: React.CSSProperties = {
  border: "1px solid #2a3a58",
  background: "#22314f",
  color: "#dce8f8",
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 700,
  padding: "2px 8px",
  cursor: "pointer",
};
