import { cn } from "@/lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "elev" | "sunk" | "outline";
  as?: "div" | "article" | "section" | "aside";
};

const tones = {
  default: "bg-bg-elev border border-rule",
  elev: "bg-bg-elev border border-rule shadow-[var(--shadow-1)]",
  sunk: "bg-bg-sunk border border-rule",
  outline: "bg-transparent border border-rule-strong",
};

export function Card({ children, className, tone = "default", as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--radius)]",
        tones[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-rule px-5 py-4", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
