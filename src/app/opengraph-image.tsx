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
const brassLight = "rgba(181, 151, 90, 0.35)";

/*
 * Composition notes: satori (the next/og renderer) does not reliably apply the
 * `inset` shorthand, so decorations use explicit top/right/bottom/left and the
 * content is centred by the root flex container itself rather than an
 * absolutely-positioned overlay.
 */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 48,
          background: `linear-gradient(135deg, ${greenDeep} 0%, ${green} 55%, ${greenDark} 100%)`,
          position: "relative",
          overflow: "hidden",
          fontFamily: "Georgia, serif",
        }}
      >
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

        {/* Vertical hairlines */}
        <div
          style={{
            position: "absolute",
            left: 130,
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
            right: 130,
            top: 0,
            bottom: 0,
            width: 1,
            background: `linear-gradient(to bottom, transparent, ${brassLight}, transparent)`,
            display: "flex",
          }}
        />

        {/* Corner brackets */}
        <div style={{ position: "absolute", top: 36, left: 56, width: 44, height: 44, borderTop: `1px solid ${brassLight}`, borderLeft: `1px solid ${brassLight}`, display: "flex" }} />
        <div style={{ position: "absolute", top: 36, right: 56, width: 44, height: 44, borderTop: `1px solid ${brassLight}`, borderRight: `1px solid ${brassLight}`, display: "flex" }} />
        <div style={{ position: "absolute", bottom: 84, left: 56, width: 44, height: 44, borderBottom: `1px solid ${brassLight}`, borderLeft: `1px solid ${brassLight}`, display: "flex" }} />
        <div style={{ position: "absolute", bottom: 84, right: 56, width: 44, height: 44, borderBottom: `1px solid ${brassLight}`, borderRight: `1px solid ${brassLight}`, display: "flex" }} />

        {/* Monogram */}
        <div style={{ display: "flex", marginBottom: 30 }}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="60" height="60">
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
        <div style={{ display: "flex", alignItems: "center", marginBottom: 26 }}>
          <span style={{ fontSize: 64, fontWeight: 400, color: cream, letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1 }}>
            MERITUS
          </span>
          <span style={{ fontSize: 54, color: brass, margin: "0 22px", fontWeight: 300, lineHeight: 1 }}>|</span>
          <span style={{ fontSize: 64, fontWeight: 400, color: cream, letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1 }}>
            VIA
          </span>
        </div>

        {/* Divider rule */}
        <div
          style={{
            width: 380,
            height: 1,
            background: `linear-gradient(to right, transparent, ${brass}, transparent)`,
            marginBottom: 26,
            display: "flex",
          }}
        />

        {/* Kicker */}
        <div
          style={{
            fontSize: 19,
            color: "rgba(181, 151, 90, 0.9)",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            fontFamily: "monospace",
            marginBottom: 30,
            display: "flex",
          }}
        >
          Construction Disputes Advisory
        </div>

        {/* Value line */}
        <div
          style={{
            fontSize: 25,
            color: "rgba(245, 240, 232, 0.72)",
            textAlign: "center",
            lineHeight: 1.5,
            fontWeight: 300,
            display: "flex",
          }}
        >
          Forensic intelligence for high-value construction disputes.
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
            borderTop: "1px solid rgba(181, 151, 90, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "rgba(181, 151, 90, 0.6)",
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
