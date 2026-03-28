import { ImageResponse } from "next/og";
import { SITE_CONFIG } from "@/lib/constants";

export const runtime = "edge";
export const alt = `${SITE_CONFIG.name} — Construction Disputes Advisory`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const brass = "#B5975A";
const green = "#0B3B24";
const greenDark = "#072E1B";
const greenDeep = "#052314";
const cream = "#F5F0E8";
const creamFaint = "rgba(245, 240, 232, 0.5)";
const brassLight = "rgba(181, 151, 90, 0.3)";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: greenDark,
          position: "relative",
          overflow: "hidden",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Background architectural lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: `linear-gradient(135deg, ${greenDeep} 0%, ${green} 60%, ${greenDark} 100%)`,
          }}
        />

        {/* Vertical accent lines */}
        <div
          style={{
            position: "absolute",
            left: "15%",
            top: 0,
            bottom: 0,
            width: 1,
            background: `linear-gradient(to bottom, transparent, ${brassLight}, transparent)`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "15%",
            top: 0,
            bottom: 0,
            width: 1,
            background: `linear-gradient(to bottom, transparent, ${brassLight}, transparent)`,
            display: "flex",
          }}
        />

        {/* Top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(to right, transparent, ${brass}, transparent)`,
            display: "flex",
          }}
        />

        {/* Corner bracket — top left */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 60,
            width: 40,
            height: 40,
            borderTop: `1px solid ${brassLight}`,
            borderLeft: `1px solid ${brassLight}`,
            display: "flex",
          }}
        />
        {/* Corner bracket — top right */}
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 60,
            width: 40,
            height: 40,
            borderTop: `1px solid ${brassLight}`,
            borderRight: `1px solid ${brassLight}`,
            display: "flex",
          }}
        />
        {/* Corner bracket — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 60,
            width: 40,
            height: 40,
            borderBottom: `1px solid ${brassLight}`,
            borderLeft: `1px solid ${brassLight}`,
            display: "flex",
          }}
        />
        {/* Corner bracket — bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 60,
            width: 40,
            height: 40,
            borderBottom: `1px solid ${brassLight}`,
            borderRight: `1px solid ${brassLight}`,
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 100px",
          }}
        >
          {/* Logo mark — M icon */}
          <div style={{ display: "flex", marginBottom: 32 }}>
            <svg
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
            >
              <line x1="18" y1="76" x2="82" y2="76" stroke="rgba(181,151,90,0.3)" strokeWidth="1" />
              <line x1="28" y1="28" x2="28" y2="74" stroke={brass} strokeWidth="3.5" strokeLinecap="square" />
              <line x1="72" y1="28" x2="72" y2="74" stroke={brass} strokeWidth="3.5" strokeLinecap="square" />
              <line x1="28" y1="28" x2="50" y2="52" stroke={brass} strokeWidth="2.5" strokeLinecap="square" />
              <line x1="72" y1="28" x2="50" y2="52" stroke={brass} strokeWidth="2.5" strokeLinecap="square" />
              <line x1="22" y1="28" x2="34" y2="28" stroke={brass} strokeWidth="2" strokeLinecap="square" />
              <line x1="66" y1="28" x2="78" y2="28" stroke={brass} strokeWidth="2" strokeLinecap="square" />
              <line x1="20" y1="74" x2="36" y2="74" stroke={brass} strokeWidth="2.5" strokeLinecap="square" />
              <line x1="64" y1="74" x2="80" y2="74" stroke={brass} strokeWidth="2.5" strokeLinecap="square" />
            </svg>
          </div>

          {/* Wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 52,
                fontWeight: 400,
                color: cream,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              MERITUS
            </span>
            <span
              style={{
                fontSize: 44,
                color: brass,
                margin: "0 16px",
                fontWeight: 300,
              }}
            >
              |
            </span>
            <span
              style={{
                fontSize: 52,
                fontWeight: 400,
                color: cream,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              VIA
            </span>
          </div>

          {/* Divider rule */}
          <div
            style={{
              width: 320,
              height: 1,
              background: `linear-gradient(to right, transparent, ${brass}, transparent)`,
              marginBottom: 24,
              display: "flex",
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: 18,
              color: creamFaint,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontFamily: "monospace",
              marginBottom: 32,
              display: "flex",
            }}
          >
            Construction Disputes Advisory
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 20,
              color: "rgba(245, 240, 232, 0.65)",
              textAlign: "center",
              maxWidth: 700,
              lineHeight: 1.6,
              fontWeight: 300,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {SITE_CONFIG.description}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 48,
            background: greenDeep,
            borderTop: `1px solid rgba(181, 151, 90, 0.1)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "rgba(181, 151, 90, 0.5)",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}
          >
            meritusvia.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
