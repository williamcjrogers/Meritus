import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonBaseProps {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

interface ButtonAsLink extends ButtonBaseProps { href: string; type?: never; disabled?: never; onClick?: never; }
interface ButtonAsButton extends ButtonBaseProps { href?: never; type?: ButtonHTMLAttributes<HTMLButtonElement>["type"]; disabled?: boolean; onClick?: () => void; }
type ButtonProps = ButtonAsLink | ButtonAsButton;

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-green text-cream border-l-[3px] border-l-brass hover:bg-green-light",
  secondary: "bg-transparent text-green border border-green/20 hover:border-brass hover:text-brass",
  ghost: "bg-transparent text-brass border-b border-brass/40 rounded-none px-0 hover:border-brass",
};

export function Button({ variant = "primary", children, className = "", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center px-6 py-3 text-[13px] font-medium tracking-wide rounded-none transition-all duration-300 focus-visible:outline-2 focus-visible:outline-brass focus-visible:outline-offset-2";
  const combined = `${base} ${variantStyles[variant]} ${className}`;

  if ("href" in props && props.href) {
    return <Link href={props.href} className={combined}>{children}</Link>;
  }
  const { type = "button", disabled, onClick } = props as ButtonAsButton;
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${combined} disabled:opacity-40 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}
