// components/ui/scene-bundle.ts
// 씬 프로젝트를 하나의 ZIP으로 묶고/푼다.
//   구조:  <씬이름>.btw            (JSON 본문 — 이미지/음원은 아래 폴더 상대경로로 참조)
//          img/imageN.png ...      (벽/배경/도형 이미지, data URL을 파일로 추출)
//          sound/<원본파일명>       (로드된 음원 원본)
// 내보내기: buildSceneZip · 불러오기: importSceneZip (round-trip)

import { useSceneStore } from "../../store/scene-store";
import { useAudioStore } from "../../store/audio-store";
import { getLoadedAudioFile, loadAudioFile } from "./audio/audio-player";
import { computeWaveform } from "./audio/waveform";
import { zipSync, unzipSync } from "./zip";

// ─── data URL ↔ bytes ───
function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const comma = dataUrl.indexOf(",");
  const head = dataUrl.slice(0, comma);
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "png";
}
function mimeForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const m: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  return m[ext] ?? "image/png";
}

function baseName(sceneName: string): string {
  const safe = (sceneName || "scene").replace(/[\\/:*?"<>|]+/g, "_").trim() || "scene";
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const ts =
    `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}` +
    `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return `${safe}_${ts}`;
}

/** 현재 씬을 ZIP Blob으로 — .btw + img/ + sound/ */
export async function buildSceneZip(): Promise<{ blob: Blob; name: string }> {
  const scene = useSceneStore.getState().exportScene();
  // 참조를 상대경로로 바꿀 것이므로 깊은 복사본을 만든다
  const json = JSON.parse(JSON.stringify(scene)) as typeof scene;
  const entries: { name: string; data: Uint8Array }[] = [];

  // 이미지: data URL을 img/ 파일로 추출하고 참조를 경로로 교체(중복 제거)
  const seen = new Map<string, string>();
  let n = 0;
  const extract = (dataUrl: string | null | undefined): string | null | undefined => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return dataUrl;
    const hit = seen.get(dataUrl);
    if (hit) return hit;
    const { mime, bytes } = dataUrlToBytes(dataUrl);
    const path = `img/image${++n}.${extForMime(mime)}`;
    seen.set(dataUrl, path);
    entries.push({ name: path, data: bytes });
    return path;
  };
  if (json.scene) json.scene.backgroundImage = extract(json.scene.backgroundImage) ?? null;
  for (const o of json.objects ?? []) {
    if (o.objectProperty?.imageUrl) o.objectProperty.imageUrl = extract(o.objectProperty.imageUrl) as string;
  }

  // 음원: 로드된 원본이 있으면 sound/ 밑에
  const audioFile = getLoadedAudioFile();
  if (audioFile && useAudioStore.getState().loaded) {
    const bytes = new Uint8Array(await audioFile.arrayBuffer());
    const fname = audioFile.name || "audio.mp3";
    entries.push({ name: `sound/${fname}`, data: bytes });
    if (json.audio) json.audio.fileName = fname;
  }

  const base = baseName(scene.sceneName);
  const enc = new TextEncoder();
  // .btw 본문을 루트에 (맨 앞)
  entries.unshift({ name: `${base}.btw`, data: enc.encode(JSON.stringify(json, null, 2)) });

  return { blob: zipSync(entries), name: `${base}.zip` };
}

/** ZIP 파일을 불러와 씬 + 이미지 + 음원 복원 */
export async function importSceneZip(file: File): Promise<{ ok: boolean; error?: string }> {
  let entries;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "ZIP을 읽을 수 없습니다" };
  }
  const byName = new Map(entries.map((e) => [e.name, e.data]));
  const jsonEntry = entries.find((e) => /\.btw$/i.test(e.name)) ?? entries.find((e) => /\.json$/i.test(e.name));
  if (!jsonEntry) return { ok: false, error: "ZIP 안에 .btw 파일이 없습니다" };

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(new TextDecoder().decode(jsonEntry.data));
  } catch {
    return { ok: false, error: ".btw 파싱에 실패했습니다" };
  }

  // 상대경로 이미지 참조 → data URL 복원
  const resolve = (ref: unknown): string | undefined => {
    if (typeof ref !== "string" || !ref) return undefined;
    if (ref.startsWith("data:")) return ref;
    const data = byName.get(ref) ?? byName.get(ref.replace(/^\.?\//, ""));
    return data ? bytesToDataUrl(data, mimeForName(ref)) : undefined;
  };
  const sc = json.scene as { backgroundImage?: unknown } | undefined;
  if (sc && "backgroundImage" in sc) sc.backgroundImage = resolve(sc.backgroundImage) ?? null;
  const objects = json.objects as Array<{ objectProperty?: { imageUrl?: unknown } }> | undefined;
  for (const o of objects ?? []) {
    const p = o.objectProperty;
    if (p && p.imageUrl !== undefined) {
      const d = resolve(p.imageUrl);
      if (d) p.imageUrl = d;
      else delete p.imageUrl;
    }
  }

  const res = useSceneStore.getState().importScene(json);
  if (!res.ok) return res;

  // 음원 복원: sound/ 밑 첫 파일을 오디오 파이프라인에 로드
  const soundEntry = entries.find((e) => /^sound\//i.test(e.name) && e.data.length > 0);
  if (soundEntry) {
    const name = soundEntry.name.split("/").pop() || "audio.mp3";
    const audioFile = new File([soundEntry.data as BlobPart], name);
    try {
      const metaDur = await loadAudioFile(audioFile);
      const { peaks, duration } = await computeWaveform(audioFile);
      useAudioStore.getState().setLoaded(name, duration || metaDur, peaks);
    } catch {
      // 음원 디코드 실패는 치명적이지 않음 — 씬은 이미 로드됨
    }
  }

  return { ok: true };
}
