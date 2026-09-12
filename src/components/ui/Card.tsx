import type { ReactNode } from "react";
interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}
export function Card({ children, className = "" }: CardProps) {
  return <div className={`public-card ${className}`}>{children}</div>;
}
