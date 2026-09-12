import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonIntent = "brand" | "neutral" | "success" | "warning" | "info" | "danger";
type SharedProps = { variant?: ButtonVariant; intent?: ButtonIntent; busy?: boolean; children: ReactNode; className?: string };
type ButtonProps = SharedProps & (
  | ({ href: string; disabled?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">)
  | ({ href?: never } & ButtonHTMLAttributes<HTMLButtonElement>)
);

/** Shared emphasis, intent and pending semantics across every audience shell. */
export function Button({ variant = "primary", intent = "brand", busy = false, children, className = "", ...props }: ButtonProps) {
  const classes = `app-button app-button--${variant} app-button--${intent} ${className}`;
  if (props.href !== undefined) {
    const { href, disabled, onClick, ...linkProps } = props;
    if (disabled || busy) return <span className={classes} role="link" aria-disabled="true" aria-busy={busy || undefined}>{children}</span>;
    return <Link {...linkProps} href={href} onClick={onClick} className={classes}>{children}</Link>;
  }
  const { type = "button", disabled, ...buttonProps } = props;
  return <button {...buttonProps} type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={classes}>{children}</button>;
}
