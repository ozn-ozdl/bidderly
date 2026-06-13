import { cn } from "@/lib/cn";

type SectionLabelProps = {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "ok" | "warn" | "bad" | "info";
};

const sizes = {
  sm: "text-[10px] tracking-[0.18em]",
  md: "text-[11px] tracking-[0.18em]",
  lg: "text-xs tracking-[0.2em]",
};

const tones = {
  ok: "text-good",
  warn: "text-warn",
  bad: "text-bad",
  info: "text-info",
};

export function SectionLabel({ children, trailing, className, size = "md", tone }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span
        className={cn(
          "font-mono uppercase font-semibold text-ink-mute",
          sizes[size],
          tone ? tones[tone] : undefined,
        )}
      >
        {children}
      </span>
      {trailing}
    </div>
  );
}
