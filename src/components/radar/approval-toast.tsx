"use client";

import { BellRing, X } from "lucide-react";
import { useEffect } from "react";
import type { ApprovalRequest } from "@/lib/radar-types";

type ApprovalToastProps = {
  approval: ApprovalRequest;
  onApprove: () => void;
  onNeedsInfo: () => void;
  onDismiss: () => void;
};

export function ApprovalToast({ approval, onApprove, onNeedsInfo, onDismiss }: ApprovalToastProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "a") onApprove();
      else if (e.key.toLowerCase() === "i") onNeedsInfo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onApprove, onNeedsInfo]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="bottom-nav-offset fixed left-1/2 z-40 w-[min(100%-2rem,440px)] -translate-x-1/2 rounded-[var(--radius)] border border-rule-strong bg-bg-elev p-4 shadow-[var(--shadow-2)] lg:bottom-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-warn-soft text-warn">
          <BellRing className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-warn">
            Approval needed
          </div>
          <div className="mt-0.5 truncate font-display text-[15px] tracking-display">{approval.title}</div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-3">
            {approval.requestedAction}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-ink-mute hover:bg-bg-sunk hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-ink px-3 text-[12px] font-semibold text-bg hover:bg-ink-2"
        >
          Approve <kbd className="rounded border border-bg/30 px-1 font-mono text-[9px]">A</kbd>
        </button>
        <button
          type="button"
          onClick={onNeedsInfo}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-3 text-[12px] font-semibold text-ink-2 hover:border-rule-strong hover:text-ink"
        >
          Request info <kbd className="rounded border border-rule px-1 font-mono text-[9px]">I</kbd>
        </button>
      </div>
    </div>
  );
}
