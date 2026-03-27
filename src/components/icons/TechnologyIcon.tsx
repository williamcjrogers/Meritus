export function TechnologyIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Circuit/node pattern,technology/precision */}
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="36" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="36" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="36" cy="36" r="3" stroke="currentColor" strokeWidth="2" />
      <line x1="15" y1="12" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" />
      <line x1="33" y1="12" x2="27" y2="21" stroke="currentColor" strokeWidth="1.5" />
      <line x1="15" y1="36" x2="21" y2="27" stroke="currentColor" strokeWidth="1.5" />
      <line x1="33" y1="36" x2="27" y2="27" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
