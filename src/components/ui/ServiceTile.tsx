"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface ServiceTileProps { title: string; description: string; href: string; }

export function ServiceTile({ title, description, href }: ServiceTileProps) {
  return (
    <Link href={href} className="group block">
      <motion.div className="h-full p-8 lg:p-10 border border-cream/20 transition-colors duration-300 hover:border-brass/40" whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
        <h3 className="font-sans text-sm font-medium tracking-[0.15em] uppercase text-cream/90">{title}</h3>
        <p className="mt-3 text-cream/60 text-[15px] leading-relaxed">{description}</p>
        <div className="mt-6 flex items-center text-brass text-sm font-medium">
          <span>Learn more</span>
          <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
        </div>
      </motion.div>
    </Link>
  );
}
