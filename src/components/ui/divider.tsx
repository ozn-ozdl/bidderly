import { cn } from "@/lib/cn";

type DividerProps = {
  orientation?: "h" | "v";
  className?: string;
  label?: string;
};

export function Divider({ orientation = "h", className, label }: DividerProps) {
  if (label) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 text-[11px] font-mono uppercase tracking-[0.16em] text-ink-mute",
          className,
        )}
      >
        <span className="h-px flex-1 bg-rule" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
    );
  }

  if (orientation === "v") {
    return <span className={cn("block w-px self-stretch bg-rule", className)} />;
  }

  return <span className={cn("block h-px w-full bg-rule", className)} />;
}
