import { SectionLabel } from "@/components/ui/section-label";

export function LandingPrivacy() {
  return (
    <section id="privacy" className="border-t border-rule bg-bg-deep py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div>
            <SectionLabel size="lg">Privacy by design</SectionLabel>
            <h2 className="mt-3 font-display text-[40px] font-normal leading-[1.05] tracking-display sm:text-[52px]">
              We read
              <br />
              <em className="not-italic text-accent">public sources.</em>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.6] text-ink-2">
              Bidderly is a research tool, not a tracker. We watch public tender portals,
              council project pages, and curated demo feeds. We do not crawl behind logins,
              store personal data of buyers, or share findings with third parties.
            </p>
          </div>

          <ul className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-rule bg-rule sm:grid-cols-2">
            <Promise
              title="Public scope only"
              body="Watchlisted pages, public portals, Tavily enrichment. No behind-the-login crawling."
            />
            <Promise
              title="GDPR-friendly"
              body="Data minimization, EU-region Postgres, no buyer PII collected. DPA on request."
            />
            <Promise
              title="You own your data"
              body="Findings, scores, and approvals live in your Postgres. Export at any time."
            />
            <Promise
              title="Local-first demo"
              body="Fixtures work without any provider keys. Production adapters plug into the same model."
            />
          </ul>
        </div>
      </div>
    </section>
  );
}

function Promise({ title, body }: { title: string; body: string }) {
  return (
    <li className="bg-bg-elev p-5 sm:p-6">
      <div className="font-display text-lg tracking-display">{title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{body}</p>
    </li>
  );
}
