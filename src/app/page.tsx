import Link from "next/link";
import { BrandMark } from "@/components/ui/brand";
import { ThemeSwitcher } from "@/components/ui/site-theme";
import { defaultTheme } from "@/lib/theme";
import { LandingHero } from "@/components/landing/hero";
import { LandingCascade } from "@/components/landing/cascade";
import { LandingFindings } from "@/components/landing/findings";
import { LandingSources } from "@/components/landing/sources";
import { LandingStack } from "@/components/landing/stack";
import { LandingPrivacy } from "@/components/landing/privacy";
import { LandingCta } from "@/components/landing/cta";
import { LandingFooter } from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-bg text-ink">
      <SiteHeader />
      <main className="relative">
        <LandingHero />
        <LandingCascade />
        <LandingFindings />
        <LandingSources />
        <LandingStack />
        <LandingPrivacy />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/65">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center" aria-label="Bidderly.win home">
          <BrandMark theme={defaultTheme} size="sm" />
        </Link>

        <nav className="hidden items-center gap-6 text-[13px] text-ink-3 md:flex">
          <Link href="#cascade" className="hover:text-ink">
            How it works
          </Link>
          <Link href="#findings" className="hover:text-ink">
            What it finds
          </Link>
          <Link href="#stack" className="hover:text-ink">
            Stack
          </Link>
          <Link href="#privacy" className="hover:text-ink">
            Privacy
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitcher current={defaultTheme} className="hidden sm:inline-flex" />
          <Link
            href="/direction-preview"
            className="hidden text-[12px] text-ink-3 hover:text-ink sm:inline"
          >
            Design preview
          </Link>
          <Link
            href="/radar"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-ink px-3.5 text-[12px] font-semibold text-bg hover:bg-ink-2"
          >
            Open radar
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <path d="M2 5.5h7M5.5 2l3.5 3.5L5.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
