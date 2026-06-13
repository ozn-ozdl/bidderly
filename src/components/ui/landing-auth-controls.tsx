"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

type LandingAuthControlsProps = {
  configured: boolean;
  className?: string;
};

export function LandingAuthControls({ configured, className }: LandingAuthControlsProps) {
  if (!configured) return null;

  return (
    <div className={className}>
      <Show
        when="signed-out"
        fallback={
          <div className="flex h-9 items-center justify-center">
            <UserButton
              appearance={{
                elements: { avatarBox: "h-7 w-7" },
              }}
            />
          </div>
        }
      >
        <SignInButton mode="modal">
          <button
            type="button"
            className="hidden h-9 items-center px-2.5 text-[12px] font-medium text-ink-3 hover:text-ink sm:inline-flex"
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-3.5 text-[12px] font-semibold text-ink-2 hover:border-rule-strong hover:text-ink"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>
    </div>
  );
}
