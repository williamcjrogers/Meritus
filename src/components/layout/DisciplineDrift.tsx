const LINE =
  "delay analysis · quantum · fire safety · drawing review · prolongation · causation · advisory · measured works · cladding · specification compliance · mediation · disruption · building safety act · final account · expert testimony · design liability · ";

/**
 * DisciplineDrift — the endlessly left-scrolling keyword ticker in the footer.
 *
 * Two identical copies of the line drift in sync: a faint gold base copy that is
 * always visible, and an orange copy stacked exactly on top. The orange copy is
 * masked (in CSS) so it only shows through a band at the centre of the page —
 * so each keyword lights up orange as it passes the middle, then fades back.
 * Pure CSS, no JavaScript, so it runs everywhere the page does.
 */
export function DisciplineDrift() {
  const track = (
    <>
      <span>{LINE}</span>
      <span>{LINE}</span>
    </>
  );

  return (
    <div
      className="relative overflow-hidden border-b border-brass/10 bg-[#041a0f]"
      aria-hidden="true"
    >
      {/* Base copy — faint, always on */}
      <div className="footer-drift whitespace-nowrap py-3 font-mono text-[9px] tracking-[0.3em] uppercase text-brass/30">
        {track}
      </div>

      {/* Orange copy — revealed only where it crosses the centre of the page */}
      <div className="drift-spotlight pointer-events-none absolute inset-0 overflow-hidden">
        <div className="footer-drift whitespace-nowrap py-3 font-mono text-[9px] tracking-[0.3em] uppercase text-[#ff9333]">
          {track}
        </div>
      </div>
    </div>
  );
}
