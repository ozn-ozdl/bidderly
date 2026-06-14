import Image from "next/image";
import { SectionLabel } from "@/components/ui/section-label";

const screenshots = [
  {
    src: "/ios/radar.png",
    alt: "Opportunity Radar dashboard with Decide section",
    caption: "Radar",
    detail: "Scan scored findings and decide in one tap.",
  },
  {
    src: "/ios/approvals.png",
    alt: "Approvals tab with Approve and Need info buttons",
    caption: "Approvals",
    detail: "Approve or request info without opening the laptop.",
  },
  {
    src: "/ios/alarm.png",
    alt: "Foreground push alarm and approval modal",
    caption: "Push alarm",
    detail: "High-urgency findings break through when it matters.",
  },
  {
    src: "/ios/negotiations.png",
    alt: "Negotiations trade-off options detail",
    caption: "Negotiations",
    detail: "Compare trade-offs and move deals forward on the go.",
  },
] as const;

export function LandingIosCompanion() {
  return (
    <section id="ios" className="border-t border-rule bg-bg-deep py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionLabel size="lg">iOS companion</SectionLabel>
            <h2 className="mt-4 font-display text-[40px] font-normal leading-[1.05] tracking-display sm:text-[52px]">
              Take it
              <br />
              <em className="not-italic text-accent">on the road.</em>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.6] text-ink-2">
              The same radar, approvals, and negotiation workflow in your pocket. Native push
              alarms surface only the findings worth interrupting you for — everything else stays
              in the feed until you are ready.
            </p>
            <ul className="mt-8 space-y-3 text-[14px] text-ink-2">
              {[
                "Live sync with the web radar and approval queue",
                "Foreground alarms for high-urgency human-review items",
                "Negotiation trade-offs with one-tap approve or need-info",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0">
            {screenshots.map((shot) => (
              <PhoneScreenshot key={shot.src} {...shot} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneScreenshot({
  src,
  alt,
  caption,
  detail,
}: {
  src: string;
  alt: string;
  caption: string;
  detail: string;
}) {
  return (
    <figure className="group w-[min(72vw,260px)] shrink-0 sm:w-auto">
      <div className="relative mx-auto w-full max-w-[240px]">
        <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-accent/6 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
        <div className="overflow-hidden rounded-[2rem] border-[3px] border-ink/90 bg-ink p-[6px] shadow-[var(--shadow-2)]">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-bg-sunk">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-1.5">
              <span className="h-[18px] w-[72px] rounded-full bg-ink/90" aria-hidden />
            </div>
            <div className="relative aspect-[9/19.5]">
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(max-width: 640px) 72vw, 240px"
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center sm:text-left">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          {caption}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-ink-3">{detail}</p>
      </figcaption>
    </figure>
  );
}
