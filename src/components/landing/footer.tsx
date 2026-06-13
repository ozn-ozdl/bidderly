import Link from "next/link";
import { BrandMark } from "@/components/ui/brand";
import { defaultTheme } from "@/lib/theme";

export function LandingFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <BrandMark theme={defaultTheme} size="md" />
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-ink-3">
            A proactive tender and procurement opportunity radar for sales teams operating in
            Germany and the EU.
          </p>
          <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            © 2026 · bidderly.win · all rights reserved
          </div>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { label: "Live radar", href: "/radar" },
            { label: "Direction preview", href: "/direction-preview" },
            { label: "Demo script", href: "/radar#demo" },
          ]}
        />
        <FooterColumn
          title="Stack"
          links={[
            { label: "Pioneer GLiNER2", href: "#stack" },
            { label: "Pioneer Gemma 4", href: "#stack" },
            { label: "Gemini 2.5", href: "#stack" },
            { label: "Tavily", href: "#stack" },
          ]}
        />
        <FooterColumn
          title="Trust"
          links={[
            { label: "Privacy", href: "#privacy" },
            { label: "GDPR", href: "#privacy" },
            { label: "Data export", href: "#privacy" },
            { label: "Contact", href: "mailto:hi@bidderly.win" },
          ]}
        />
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-[13px] text-ink-2 hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
