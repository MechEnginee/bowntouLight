// components/ui/ImagePicker.tsx
// 이미지 파일 선택 UI — 썸네일 + "넣기/변경" + "제거". 벽 표면·배경 이미지 공용.
// 선택한 파일은 fileToDataURL로 (다운스케일된) data URL이 되어 onChange로 전달된다.

import { useRef, useState } from "react";
import { fileToDataURL } from "./image-utils";

const btnStyle: React.CSSProperties = {
  border: "1px solid #3a5a8c",
  background: "#22314f",
  color: "#dce8f8",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 9px",
  cursor: "pointer",
};

export function ImagePicker({
  value,
  onChange,
  label = "이미지",
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToDataURL(file));
    } catch {
      alert("이미지를 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {value ? (
        <img
          src={value}
          alt=""
          style={{ width: 44, height: 32, objectFit: "cover", borderRadius: 4, border: "1px solid #33334d" }}
        />
      ) : (
        <div
          style={{
            width: 44,
            height: 32,
            borderRadius: 4,
            border: "1px dashed #44445a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "#666",
          }}
        >
          없음
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = ""; // 같은 파일 재선택 허용
          pick(file);
        }}
      />
      <button onClick={() => inputRef.current?.click()} disabled={busy} style={btnStyle}>
        {busy ? "불러오는 중…" : value ? `${label} 변경` : `${label} 넣기`}
      </button>
      {value && (
        <button onClick={() => onChange(null)} style={{ ...btnStyle, background: "#3a1e1e", color: "#e79a9a" }}>
          제거
        </button>
      )}
    </div>
  );
}
