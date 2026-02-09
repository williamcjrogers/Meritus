"use client";

import { motion } from "framer-motion";

const stages = [
  { title: "Instruct", description: "Direct engagement with a senior practitioner from day one." },
  { title: "Ingest", description: "Proprietary document review and classification technology. Speed without sacrificing rigour." },
  { title: "Analyse", description: "AI-augmented pattern identification combined with expert judgment. Every conclusion traced to source." },
  { title: "Deliver", description: "Clear, defensible reports. Testimony-ready positions. Structured for your dispute forum." },
];

export function MethodologyFlow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
      {stages.map((stage, index) => (
        <motion.div key={stage.title} className="relative" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: index * 0.2 }}>
          <div className="p-6 lg:p-8">
            <div className="font-mono text-sm text-brass mb-3">0{index + 1}</div>
            <h3 className="font-serif text-xl text-green mb-3">{stage.title}</h3>
            <p className="text-sm text-slate leading-relaxed">{stage.description}</p>
          </div>
          {index < stages.length - 1 && (
            <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-px bg-brass/40" aria-hidden="true">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brass" />
            </div>
          )}
          {index < stages.length - 1 && (
            <div className="lg:hidden flex justify-center py-2" aria-hidden="true"><div className="w-px h-6 bg-brass/40" /></div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
