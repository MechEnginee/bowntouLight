// components/ui/EyeDropperButton.tsx
// 스포이드(색 추출) 버튼 — 브라우저 네이티브 EyeDropper API로 화면 어디서든 픽셀 색을 집는다.
// 지원하지 않는 브라우저에서는 렌더하지 않는다(feature detection).

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperInstance {
  open: (options?: { signal?: AbortSignal }) => Promise<EyeDropperResult>;
}
interface EyeDropperCtor {
  new (): EyeDropperInstance;
}
declare global {
  interface Window {
    EyeDropper?: EyeDropperCtor;
  }
}

export function EyeDropperButton({
  onPick,
  title = "스포이드로 색 추출",
}: {
  /** 추출한 색(#rrggbb) 콜백 */
  onPick: (hex: string) => void;
  title?: string;
}) {
  const supported = typeof window !== "undefined" && "EyeDropper" in window;
  if (!supported) return null;

  const pick = async () => {
    try {
      const ed = new window.EyeDropper!();
      const res = await ed.open();
      onPick(res.sRGBHex);
    } catch {
      // 사용자가 ESC로 취소 — 무시
    }
  };

  return (
    <button
      type="button"
      onClick={pick}
      onPointerDown={(e) => e.stopPropagation()}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        flex: "0 0 auto",
        border: "1px solid #333350",
        borderRadius: 4,
        background: "#22223a",
        color: "#9ab8e0",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {/* 스포이드(파이펫) 아이콘 */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 22 1-1h3l9-9" />
        <path d="M3 21v-3l9-9" />
        <path d="m15 6 3.4-3.4a2.1 2.1 0 0 1 3 3L18 9l.4.4a2.1 2.1 0 0 1 0 3 2.1 2.1 0 0 1-3 0l-6-6a2.1 2.1 0 0 1 0-3 2.1 2.1 0 0 1 3 0l.6.6Z" />
      </svg>
    </button>
  );
}
