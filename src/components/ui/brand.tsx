import { cn } from "@/lib/cn";
import type { ThemeId } from "@/lib/theme";

type BrandMarkProps = {
  theme: ThemeId;
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
};

const sizeMap = {
  sm: { box: 24, mark: 11, text: "text-[13px]" },
  md: { box: 32, mark: 14, text: "text-sm" },
  lg: { box: 44, mark: 18, text: "text-base" },
};

export function BrandMark({ theme, className, size = "md", showWordmark = true }: BrandMarkProps) {
  const s = sizeMap[size];

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        width={s.box}
        height={s.box}
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <radialGradient id={`mark-${theme}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.0" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="15" fill={`url(#mark-${theme})`} />
        <circle cx="16" cy="16" r="13.5" fill="none" stroke="currentColor" strokeOpacity="0.25" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeOpacity="0.45" />
        <circle cx="16" cy="16" r="4.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <line
          x1="16"
          y1="2.5"
          x2="16"
          y2="29.5"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="0.5"
        />
        <line
          x1="2.5"
          y1="16"
          x2="29.5"
          y2="16"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="0.5"
        />
        <line
          x1="16"
          y1="16"
          x2="24"
          y2="8.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="24" cy="8.5" r="1.5" fill="currentColor" />
      </svg>
      {showWordmark ? (
        <div className="flex flex-col leading-none">
          <span className={cn("font-semibold tracking-tight", s.text)}>
            Bidderly<span className="opacity-60">.win</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function ThemeFrameLabel({ label }: { id: ThemeId; label: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {label}
    </div>
  );
}
