import { ImageResponse } from "next/og";

// Route segment config
export const runtime = "edge";

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = "image/png";

// Design tokens
const brass = "#B5975A";
const darkGreen = "#0B3B24";
const borderColor = "rgba(181, 151, 90, 0.4)"; // 40% opacity brass
const bgBorderWidth = 1;

export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    fontSize: 24,
                    background: darkGreen,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `${bgBorderWidth}px solid ${borderColor}`,
                    borderRadius: "4px", // Slight curve for premium feel
                    boxSizing: "border-box",
                }}
            >
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                >
                    {/* Base Datum Line */}
                    <line
                        x1="18"
                        y1="76"
                        x2="82"
                        y2="76"
                        stroke="rgba(181,151,90,0.3)"
                        strokeWidth="1"
                    />

                    {/* Left Column */}
                    <line
                        x1="28"
                        y1="28"
                        x2="28"
                        y2="74"
                        stroke={brass}
                        strokeWidth="3.5"
                        strokeLinecap="square"
                    />

                    {/* Right Column */}
                    <line
                        x1="72"
                        y1="28"
                        x2="72"
                        y2="74"
                        stroke={brass}
                        strokeWidth="3.5"
                        strokeLinecap="square"
                    />

                    {/* Validation Check / Inner V */}
                    <line
                        x1="28"
                        y1="28"
                        x2="50"
                        y2="52"
                        stroke={brass}
                        strokeWidth="2.5"
                        strokeLinecap="square"
                    />
                    <line
                        x1="72"
                        y1="28"
                        x2="50"
                        y2="52"
                        stroke={brass}
                        strokeWidth="2.5"
                        strokeLinecap="square"
                    />

                    {/* Top Serifs */}
                    <line
                        x1="22"
                        y1="28"
                        x2="34"
                        y2="28"
                        stroke={brass}
                        strokeWidth="2"
                        strokeLinecap="square"
                    />
                    <line
                        x1="66"
                        y1="28"
                        x2="78"
                        y2="28"
                        stroke={brass}
                        strokeWidth="2"
                        strokeLinecap="square"
                    />

                    {/* Bottom Serifs (Foundations) */}
                    <line
                        x1="20"
                        y1="74"
                        x2="36"
                        y2="74"
                        stroke={brass}
                        strokeWidth="2.5"
                        strokeLinecap="square"
                    />
                    <line
                        x1="64"
                        y1="74"
                        x2="80"
                        y2="74"
                        stroke={brass}
                        strokeWidth="2.5"
                        strokeLinecap="square"
                    />
                </svg>
            </div>
        ),
        // ImageResponse options
        {
            ...size,
        }
    );
}
