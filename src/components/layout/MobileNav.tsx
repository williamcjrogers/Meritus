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
                className="mt-4 text-sm text-brass border-b border-brass/40 pb-1 tracking-wide"
              >
                Request Conflict Check
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: (NAV_ITEMS.length + 1) * 0.06 }}
            >
              <Link
                href="https://intelligence.meritusvia.com/#dashboard"
                onClick={onClose}
                className="mt-6 text-sm text-green bg-brass px-6 py-2 rounded-sm tracking-wide font-medium inline-block"
              >
                Claims Intelligence Login
              </Link>
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
