"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_ITEMS } from "@/lib/constants";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-40 bg-green lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <nav className="flex flex-col items-center justify-center h-full gap-10" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="text-xl text-cream/70 tracking-wide hover:text-brass transition-colors duration-200"
                >
                  {item.label}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: NAV_ITEMS.length * 0.06 }}
            >
              <Link
                href="/contact"
                onClick={onClose}
                className="mt-4 group inline-flex items-center gap-2 px-5 py-2.5 rounded-md border-2 border-brass bg-brass text-sm text-green tracking-wide transition-all duration-200 hover:bg-brass-light hover:border-brass-light hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(181,151,90,0.15)]"
              >
                Request Conflict Check
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
