import { SectorsClient } from "./SectorsClient";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sectors",
  description:
    "Construction disputes expertise across buildings, infrastructure, and energy. Forensic delay, quantum, and technical analysis tailored to the contractual framework of each sector.",
  path: "/sectors",
  keywords: [
    "construction disputes sectors",
    "buildings disputes",
    "infrastructure disputes",
    "energy construction disputes",
    "rail construction dispute",
    "Building Safety Act cladding",
  ],
});

export default function SectorsPage() {
  return <SectorsClient />;
}
