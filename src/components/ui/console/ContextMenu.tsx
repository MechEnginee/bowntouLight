// components/ui/console/ContextMenu.tsx
// Groups/Looks 터치버튼 우클릭 메뉴 — 커서 위치에 뜨는 간단한 팝업.
// 항목에 submenu(예: 슬롯 1~10 선택)를 붙일 수 있다.

import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  danger?: boolean;
  /** 제공 시 클릭하면 서브메뉴(슬롯 목록 등)를 펼친다 */
  submenu?: { label: string; onSelect: () => void }[];
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const [openSub, setOpenSub] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const itemStyle: React.CSSProperties = {
    padding: "6px 12px",
    fontSize: 12,
    color: "#d8d8e0",
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 1000,
        background: "#1e1e30",
        border: "1px solid #3a3a5a",
        borderRadius: 6,
        boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
        padding: "4px 0",
        minWidth: 170,
        font: "12px/1.4 monospace",
      }}
    >
      {items.map((it, i) => (
        <div key={i} style={{ position: "relative" }}>
          <div
            data-menu-item={it.label}
            style={{
              ...itemStyle,
              color: it.danger ? "#e08080" : itemStyle.color,
              background: openSub === i ? "#2a2a45" : "transparent",
            }}
            onClick={() => {
              if (it.submenu) {
                setOpenSub(openSub === i ? null : i);
              } else {
                it.onSelect?.();
                onClose();
              }
            }}
            onMouseEnter={() => it.submenu && setOpenSub(i)}
          >
            <span>{it.label}</span>
            {it.submenu && <span style={{ color: "#666" }}>▸</span>}
          </div>
          {it.submenu && openSub === i && (
            <div
              style={{
                position: "absolute",
                left: "100%",
                top: 0,
                background: "#1e1e30",
                border: "1px solid #3a3a5a",
                borderRadius: 6,
                boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                padding: "4px 0",
                minWidth: 90,
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {it.submenu.map((sub, j) => (
                <div
                  key={j}
                  style={itemStyle}
                  onClick={() => {
                    sub.onSelect();
                    onClose();
                  }}
                >
                  {sub.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
