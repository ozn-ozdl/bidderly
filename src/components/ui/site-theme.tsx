"use client";

import { setTheme } from "./theme-script";
import { themeOrder, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/cn";

const labels: Record<ThemeId, string> = {
  brief: "Brief",
  console: "Console",
  atelier: "Atelier",
};

export function ThemeSwitcher({ current, className }: { current: ThemeId; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-0.5",
        className,
      )}
      role="group"
      aria-label="Theme"
    >
      {themeOrder.map((id) => {
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            className={cn(
              "rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-[11px] font-semibold transition-colors",
              active
                ? "bg-ink text-bg"
                : "text-ink-3 hover:text-ink",
            )}
            aria-pressed={active}
          >
            {labels[id]}
          </button>
        );
      })}
    </div>
  );
}
