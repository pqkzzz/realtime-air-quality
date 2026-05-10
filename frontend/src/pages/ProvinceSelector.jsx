// ── ProvinceSelector.jsx ──────────────────────────────────────────
import { useState, useRef, useEffect } from "react";

function ProvinceSelector({ provinces, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  // Đóng khi click ra ngoài
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = provinces.filter((p) =>
    p.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedSet = new Set(value);
  const isAll = selectedSet.size === 0;

  const toggle = (province) => {
    if (province === "__all__") {
      onChange([]);
      return;
    }
    const next = new Set(selectedSet);
    next.has(province) ? next.delete(province) : next.add(province);
    onChange([...next]);
  };

  const label = isAll
    ? "Toàn quốc"
    : value.length === 1
      ? value[0]
      : `${value.length} tỉnh/thành đã chọn`;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "#FFFFFF",
          border: "0.5px solid var(--color-border-secondary)",
          borderRadius: "var(--border-radius-md)",
          cursor: "pointer",
          fontSize: 14,
          color: "var(--color-text-primary)",
          gap: 8,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            flexShrink: 0,
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M2.5 5L7 9.5L11.5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 999,
            background: "#FFFFFF",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-md)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            <input
              autoFocus
              placeholder="Tìm tỉnh/thành..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                fontSize: 13,
                padding: "4px 8px",
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-primary)",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Options list */}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: "4px 0",
              maxHeight: 220,
              overflowY: "auto",
            }}
          >
            {/* Toàn quốc */}
            <li
              onClick={() => toggle("__all__")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isAll ? 500 : 400,
                background: isAll
                  ? "var(--color-background-secondary)"
                  : "transparent",
                color: "var(--color-text-primary)",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  borderRadius: 3,
                  border: "1.5px solid var(--color-border-primary)",
                  background: isAll
                    ? "var(--color-text-primary)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isAll && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path
                      d="M1 3.5L3.5 6L8 1"
                      stroke="var(--color-background-primary)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              Toàn quốc
            </li>

            {/* Provinces */}
            {filtered.map((province) => {
              const checked = selectedSet.has(province);
              return (
                <li
                  key={province}
                  onClick={() => toggle(province)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    // Nền xám nhạt khi được chọn
                    background: checked ? "#F1F5F9" : "transparent",
                    color: "#0F172A",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      borderRadius: 3,
                      border: "1.5px solid #3B82F6", // Viền ô vuông màu xanh dương
                      // Đổ nền xanh dương khi được chọn, nếu không thì rỗng
                      background: checked ? "#3B82F6" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {checked && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path
                          d="M1 3.5L3.5 6L8 1"
                          stroke="#FFFFFF" /* DẤU TÍCH MÀU TRẮNG Ở ĐÂY */
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {province}
                </li>
              );
            })}

            {filtered.length === 0 && (
              <li
                style={{
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                }}
              >
                Không tìm thấy
              </li>
            )}
          </ul>

          {/* Footer: clear / close */}
          {!isAll && (
            <div
              style={{
                borderTop: "0.5px solid var(--color-border-tertiary)",
                padding: "6px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
              >
                {value.length} / {provinces.length} đã chọn
              </span>
              <button
                onClick={() => onChange([])}
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: 4,
                }}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProvinceSelector;
