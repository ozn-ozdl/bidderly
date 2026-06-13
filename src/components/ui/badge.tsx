import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "accent" | "signal";
type Size = "xs" | "sm" | "md";

const tones: Record<Tone, string> = {
  neutral: "bg-bg-sunk text-ink-3 border-rule",
  good: "bg-good-soft text-good border-good-soft",
  warn: "bg-warn-soft text-warn border-warn-soft",
  bad: "bg-bad-soft text-bad border-bad-soft",
  info: "bg-info-soft text-info border-info-soft",
  accent: "bg-accent-soft text-accent-deep border-accent-soft",
  signal: "bg-signal-soft text-signal border-signal-soft",
};

const sizes: Record<Size, string> = {
  xs: "h-5 px-1.5 text-[10px] tracking-[0.14em] font-mono",
  sm: "h-6 px-2 text-[10px] tracking-[0.14em] font-mono",
  md: "h-7 px-2.5 text-[11px] tracking-[0.12em] font-mono",
};

type BadgeProps = {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  className?: string;
  uppercase?: boolean;
  dot?: boolean;
};

export function Badge({
  tone = "neutral",
  size = "sm",
  children,
  className,
  uppercase = true,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border font-semibold",
        tones[tone],
        sizes[size],
        !uppercase && "tracking-normal normal-case font-sans",
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
