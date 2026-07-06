/**
 * Distance-scaled smooth scrolling for in-page anchors.
 *
 * The duration grows sub-linearly with distance, so the further the
 * target, the faster the page travels. Steps are issued with
 * behavior: "instant" so the CSS `scroll-behavior: smooth` on <html>
 * does not double-ease every frame.
 */

// Measure the actual fixed header rather than hardcoding a height: the header
// is 64px below the lg breakpoint and 80px at/above it, so a fixed value lands
// mobile jumps short.
function headerOffset(): number {
  if (typeof document === "undefined") return 80;
  const header = document.querySelector("header");
  const h = header instanceof HTMLElement ? header.offsetHeight : 64;
  return h + 12; // clear the fixed header, plus a small breathing gap
}

let cancelCurrent: (() => void) | null = null;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function smoothScrollToId(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;

  const offset = headerOffset();
  const targetYNow = () =>
    Math.min(
      el.getBoundingClientRect().top + window.scrollY - offset,
      document.documentElement.scrollHeight - window.innerHeight
    );

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top: targetYNow(), behavior: "instant" });
    return;
  }

  cancelCurrent?.();

  const startY = window.scrollY;
  const distance = Math.abs(targetYNow() - startY);
  if (distance < 2) return;

  // Sub-linear duration: longer journeys travel at a higher average speed
  const duration = Math.max(500, Math.min(1100, 350 + distance * 0.09));
  const start = performance.now();
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    if (cancelCurrent === cancel) cancelCurrent = null;
  };
  cancelCurrent = cancel;

  // Hand control back to the user the moment they scroll themselves
  window.addEventListener("wheel", cancel, { passive: true });
  window.addEventListener("touchstart", cancel, { passive: true });

  const step = (now: number) => {
    if (cancelled) return;
    const progress = Math.min(1, (now - start) / duration);
    // Recompute the target each frame in case late content shifts layout
    const y = startY + (targetYNow() - startY) * easeInOutCubic(progress);
    window.scrollTo({ top: y, behavior: "instant" });
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      cancel();
    }
  };

  requestAnimationFrame(step);
}
