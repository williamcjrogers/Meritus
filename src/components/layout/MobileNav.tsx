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
                className="mt-4 inline-flex items-center px-7 py-2.5 rounded-full border border-brass/40 text-sm text-brass tracking-wide transition-all duration-200 hover:border-brass hover:bg-brass/10"
              >
                Request Conflict Check
              </Link>
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
