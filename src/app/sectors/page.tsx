import type { Metadata } from "next";
import { SectorsClient } from "./SectorsClient";

export const metadata: Metadata = {
  title: "Sectors",
  description:
    "Construction disputes expertise across buildings, infrastructure, and energy. Forensic analysis tailored to the contractual framework of each sector.",
};

export default function SectorsPage() {
  return <SectorsClient />;
}
