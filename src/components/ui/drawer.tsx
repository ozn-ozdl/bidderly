"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  side?: "right" | "bottom";
  className?: string;
  ariaLabel?: string;
};

export function Drawer({
  open,
  onClose,
  children,
  width = 640,
  side = "right",
  className,
  ariaLabel,
}: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const isRight = side === "right";

  return (
    <div
      className="fixed inset-0 z-50 flex bg-ink/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "absolute inset-0",
        )}
        aria-hidden
      />
      <div
        ref={ref}
        className={cn(
          "relative ml-auto flex h-full w-full max-w-full flex-col bg-bg-elev shadow-[var(--shadow-2)]",
          isRight ? "" : "absolute bottom-0 left-0 right-0 max-h-[88vh] rounded-t-[var(--radius-lg)]",
          className,
        )}
        style={isRight ? { width: typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : width } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function DrawerHeader({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
      {children}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:bg-bg-sunk hover:text-ink"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function DrawerBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-5", className)}>{children}</div>;
}
