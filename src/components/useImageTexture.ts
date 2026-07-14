// components/useImageTexture.ts
// data URL(또는 URL) 이미지를 THREE.Texture로 비동기 로드하는 훅.
// Suspense를 쓰지 않아(useLoader 대신 수동 로드) 로딩 중에도 씬이 비지 않는다.
// url이 없으면 null. url이 바뀌면 이전 텍스처를 dispose한다.

import { useEffect, useState } from "react";
import * as THREE from "three";

export function useImageTexture(url: string | null | undefined): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    let cancelled = false;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(url, (t) => {
      if (cancelled) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      loaded = t;
      setTex(t);
    });
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [url]);

  return tex;
}
