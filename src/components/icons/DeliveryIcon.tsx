export function DeliveryIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Single bold line — directness/clarity */}
      <line x1="8" y1="24" x2="40" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="16" x2="40" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="32" x2="40" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
