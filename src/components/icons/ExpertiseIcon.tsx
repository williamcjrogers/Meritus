export function ExpertiseIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Intersecting angular lines,expertise/structure */}
      <line x1="6" y1="42" x2="42" y2="6" stroke="currentColor" strokeWidth="2" />
      <line x1="6" y1="6" x2="42" y2="42" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="4" x2="24" y2="44" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
