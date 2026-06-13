import { cn } from "@/lib/cn";

type LedDotProps = {
  tone?: "live" | "ok" | "warn" | "bad" | "off" | "info";
  size?: number;
  pulse?: boolean;
  className?: string;
};

const tones = {
  live: "bg-good shadow-[0_0_0_3px_var(--good-soft)]",
  ok: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  off: "bg-ink-faint",
  info: "bg-info",
};

export function LedDot({ tone = "ok", size = 8, pulse = false, className }: LedDotProps) {
  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60",
            tones[tone],
          )}
          style={{ animation: "ping-soft 1.6s var(--ease-out) infinite" }}
        />
      ) : null}
      <span className={cn("relative inline-block h-full w-full rounded-full", tones[tone])} />
    </span>
  );
}
