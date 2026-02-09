import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = "", hover = true }: CardProps) {
  return (
    <div
      className={`bg-white rounded-[4px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
        hover
          ? "transition-all duration-300 hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] hover:border-t-2 hover:border-t-copper"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
