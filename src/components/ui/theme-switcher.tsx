"use client";

import { useEffect } from "react";
import { setTheme } from "./theme-script";
import type { ThemeId } from "@/lib/theme";
import { cn } from "@/lib/cn";

type ThemeSwitcherProps = {
  current: ThemeId;
  className?: string;
  compact?: boolean;
};

const labels: Record<ThemeId, { name: string; mark: string }> = {
  brief: { name: "Brief", mark: "B" },
  console: { name: "Console", mark: "C" },
  atelier: { name: "Atelier", mark: "A" },
};

export function ThemeSwitcher({ current, className, compact = false }: ThemeSwitcherProps) {
  useEffect(() => {
    setTheme(current);
  }, [current]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-0.5",
        className,
      )}
      role="tablist"
      aria-label="Theme"
    >
      {(Object.keys(labels) as ThemeId[]).map((id) => {
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTheme(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-[calc(var(--radius-sm)-2px)] px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-ink text-bg"
                : "text-ink-3 hover:text-ink",
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] font-bold leading-none",
                active ? "opacity-80" : "opacity-60",
              )}
            >
              {labels[id].mark}
            </span>
            {!compact ? <span>{labels[id].name}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
