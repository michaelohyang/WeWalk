import { ImageResponse } from "next/og";

/*
 * The card chat apps show for a shared link (mostly the invite). Rendered once at build time and
 * the same for every page: link previews are fetched signed out, so it never shows crew data.
 */

export const alt = "WeWalk: NYC WeWorks, rated by people who care too much";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SCORES = [
  { label: "Coffee", value: "4.6", color: "#0f9d74" },
  { label: "Wi-Fi", value: "3.9", color: "#58b947" },
  { label: "Phone booths", value: "2.1", color: "#e2553f" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0c0e0e",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "#0a7461",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          W
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>WeWalk</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>
          NYC WeWorks, rated by people who care too much.
        </div>
        <div style={{ fontSize: 32, color: "#aab3b0" }}>
          You&apos;re invited. Pick a name, start judging.
        </div>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {SCORES.map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 24px 14px 14px",
              borderRadius: 999,
              background: "#1b1f1f",
              fontSize: 28,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: s.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 24,
              }}
            >
              {s.value}
            </div>
            {s.label}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
