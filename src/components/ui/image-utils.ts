// components/ui/image-utils.ts
// 파일 → data URL 변환(+ 다운스케일). 벽/배경 이미지를 .btw에 저장하므로
// 너무 큰 이미지는 최대 변(maxDim)에 맞춰 줄여 파일 크기를 억제한다.

/** 이미지 파일을 data URL로 (긴 변이 maxDim 초과 시 축소). PNG는 PNG, 그 외는 JPEG로 재인코딩. */
export async function fileToDataURL(file: File, maxDim = 1280): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    im.src = original;
  });

  const longest = Math.max(img.width, img.height);
  const scale = Math.min(1, maxDim / longest);
  // 이미 충분히 작으면(그리고 용량도 작으면) 원본 유지
  if (scale >= 1 && original.length < 500_000) return original;

  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, w, h);
  const isPng = file.type === "image/png";
  return canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85);
}
