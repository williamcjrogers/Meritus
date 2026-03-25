"use client";

export function HeroPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <g stroke="#B5975A" strokeWidth="1" opacity="0.06">
          <line x1="5%" y1="20%" x2="45%" y2="20%" />
          <line x1="15%" y1="30%" x2="65%" y2="30%" />
          <line x1="25%" y1="40%" x2="80%" y2="40%" />
          <line x1="10%" y1="50%" x2="55%" y2="50%" />
          <line x1="35%" y1="60%" x2="90%" y2="60%" />
          <line x1="20%" y1="70%" x2="70%" y2="70%" />
          <line x1="40%" y1="80%" x2="85%" y2="80%" />
        </g>
        <g fill="#B5975A" opacity="0.06">
          <circle cx="45%" cy="20%" r="2" />
          <circle cx="65%" cy="30%" r="2" />
          <circle cx="80%" cy="40%" r="2" />
          <circle cx="55%" cy="50%" r="2" />
          <circle cx="90%" cy="60%" r="2" />
        </g>
      </svg>
    </div>
  );
}
