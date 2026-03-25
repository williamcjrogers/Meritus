"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface CountUpProps {
  value: string;
  label: string;
}

function parseValue(val: string): { prefix: string; number: number; suffix: string } {
  const match = val.match(/^([^\d]*)([\d,]+)(.*)$/);
  if (!match) return { prefix: "", number: 0, suffix: val };
  return { prefix: match[1], number: parseInt(match[2].replace(/,/g, ""), 10), suffix: match[3] };
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-GB");
}

export function CountUp({ value, label }: CountUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.05, margin: "0px 0px 200px 0px" });
  const [count, setCount] = useState(0);
  const { prefix, number, suffix } = parseValue(value);

  useEffect(() => {
    if (!isInView || number === 0) return;

    let frame: number;
    const duration = 1600;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * number));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isInView, number]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-serif text-4xl lg:text-5xl text-brass tracking-tight leading-none">
        {isInView ? `${prefix}${formatNumber(count)}${suffix}` : value}
      </div>
      <div className="mt-3 font-mono text-[10px] tracking-[0.25em] uppercase text-cream/45">
        {label}
      </div>
    </div>
  );
}
