import { cn } from "@/lib/cn";
import type { ThemeId } from "@/lib/theme";
import { ThemeFrameLabel } from "@/components/ui/brand";

type PreviewFrameProps = {
  id: ThemeId;
  label: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  switcher?: React.ReactNode;
};

export function PreviewFrame({ id, label, description, children, className, switcher }: PreviewFrameProps) {
  return (
    <section
      data-theme={id}
      className={cn(
        "relative isolate overflow-hidden rounded-[var(--radius-lg)] border border-ink/10 bg-bg text-ink",
        "shadow-[0_30px_120px_-50px_rgba(0,0,0,0.5)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-bg-elev/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <ThemeFrameLabel id={id} label={label} />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint sm:inline">
            {description}
          </span>
        </div>
        {switcher}
      </header>
      <div className="grain relative">{children}</div>
    </section>
  );
}
