import Link from "next/link";

export function LandingCta() {
  return (
    <section className="border-t border-rule py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-rule-strong bg-ink px-6 py-14 text-bg sm:px-10 sm:py-20">
          <div className="grain pointer-events-none absolute inset-0 opacity-50" aria-hidden />
          <CtaGlow />

          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bg/60">
                ready when you are
              </div>
              <h2 className="mt-3 font-display text-[40px] font-normal leading-[1.05] tracking-display sm:text-[56px]">
                See the cascade
                <br />
                <em className="not-italic text-good">in motion.</em>
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-bg/70">
                Open the live radar, hit run scout, and watch six findings flow through the
                cascade. Approve one, request info on another, and see the timeline update in
                real time.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href="/radar"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-bg px-5 text-[14px] font-semibold text-ink hover:bg-bg-sunk"
              >
                Open the radar
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  <path
                    d="M2 6.5h9M6.5 2l4.5 4.5L6.5 11"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="/direction-preview"
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] border border-bg/20 px-5 text-[14px] font-semibold text-bg hover:bg-bg/10"
              >
                Compare design directions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaGlow() {
  return (
    <svg
      className="pointer-events-none absolute -right-32 -top-32 -z-0 h-[480px] w-[480px] opacity-60"
      viewBox="0 0 480 480"
      aria-hidden
    >
      <defs>
        <radialGradient id="cta-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7cf38c" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7cf38c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="240" r="200" fill="url(#cta-glow)" />
    </svg>
  );
}
