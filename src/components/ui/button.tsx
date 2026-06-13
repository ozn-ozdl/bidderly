import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-bg hover:bg-ink-2 active:translate-y-px disabled:bg-ink-faint disabled:text-ink-mute",
  secondary:
    "bg-bg-elev text-ink border border-rule hover:border-rule-strong hover:bg-bg-sunk disabled:opacity-50",
  ghost:
    "bg-transparent text-ink hover:bg-bg-sunk disabled:opacity-50",
  outline:
    "bg-transparent text-ink border border-rule-strong hover:bg-bg-sunk disabled:opacity-50",
  danger:
    "bg-signal text-bg hover:opacity-90 active:translate-y-px disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px] font-medium",
  md: "h-10 px-4 text-[13px] font-medium",
  lg: "h-12 px-5 text-sm font-semibold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", size = "md", className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] transition-[background,color,border,transform] duration-150 ease-[var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
