"use client";

import { DelayPattern } from "./DelayPattern";
import { QuantumPattern } from "./QuantumPattern";
import { TechnicalPattern } from "./TechnicalPattern";
import { AdvisoryPattern } from "./AdvisoryPattern";

const PATTERNS = [DelayPattern, QuantumPattern, TechnicalPattern, AdvisoryPattern] as const;

export function PillarPattern({ index, className = "" }: { index: number; className?: string }) {
  const Pattern = PATTERNS[index];
  if (!Pattern) return null;
  return <Pattern className={className} />;
}
