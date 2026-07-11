// components/ui/RgbRow.tsx
// R/G/B(0~255) 숫자 입력 3칸 + 미리보기 스와치 + 스포이드. 배경색·벽/바닥색·광원색 등에서 공용.
// 값은 [r,g,b] 숫자 배열로 다룬다. hex 변환은 color-utils에서 가져온다.

import { NumberField } from "./NumberField";
import { EyeDropperButton } from "./EyeDropperButton";
import { type Rgb, rgbToHex, hexToRgb } from "./color-utils";

const CH_LABELS = ["R", "G", "B"] as const;

export function RgbRow({
  value,
  onChange,
  onPickAll,
}: {
  value: Rgb;
  /** 한 채널(0=R,1=G,2=B) 값 변경 */
  onChange: (channel: 0 | 1 | 2, v: number) => void;
  /** 스포이드로 전체 색을 한 번에 설정 (제공 시 스포이드 버튼 노출) */
  onPickAll?: (rgb: Rgb) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 4,
          border: "1px solid #333350",
          background: rgbToHex(value),
          flex: "0 0 auto",
        }}
      />
      {CH_LABELS.map((label, ch) => (
        <div key={label} style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              color: "#555570",
              textAlign: "center",
              marginBottom: 1,
            }}
          >
            {label}
          </div>
          <NumberField
            value={value[ch]}
            decimals={0}
            width="100%"
            onCommit={(v) => onChange(ch as 0 | 1 | 2, v)}
          />
        </div>
      ))}
      {onPickAll && (
        <EyeDropperButton onPick={(hex) => onPickAll(hexToRgb(hex))} />
      )}
    </div>
  );
}
