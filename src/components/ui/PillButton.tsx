"use client";
import React from "react";
import Link from "next/link";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center rounded-full font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-white text-slate-900 shadow hover:opacity-90",
  outline:
    "border border-white/15 bg-white/5 text-white hover:shadow",
  ghost: "text-slate-800 hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

export type PillButtonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PillButton({
  children,
  className,
  variant = "primary",
  size = "md",
  block,
  loading = false,
  ...rest
}: PillButtonProps) {
  return (
    <button
      className={cx(base, variants[variant], sizes[size], block && "w-full", className)}
      aria-busy={loading || undefined}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
}

export type PillLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export function PillLink({
  href,
  children,
  className,
  variant = "primary",
  size = "md",
  block,
  loading = false,
  ...rest
}: PillLinkProps) {
  const { onClick, ...restProps } = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      try {
        if (href && href.startsWith('#')) {
          const id = href.slice(1);
          const el = document.getElementById(id);
          if (el) {
            e.preventDefault();
            const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!prefersReduced) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              el.scrollIntoView();
            }
            try { history.pushState(null, '', href); } catch {}
          }
        }
      } finally {
        onClick?.(e);
      }
    },
    [href, onClick]
  );

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-busy={loading || undefined}
      className={cx(base, variants[variant], sizes[size], block && "w-full", className, loading && "pointer-events-none opacity-70")}
      {...restProps}
    >
      {loading && (
        <span className="mr-2 inline-block h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin align-[-2px]" aria-hidden="true" />
      )}
      {children}
    </Link>
  );
}

export default PillButton;
