import Link from "next/link";
import { PreviewFrame } from "@/components/preview/preview-frame";
import { PreviewRadar } from "@/components/preview/preview-radar";
import { themes, type ThemeId } from "@/lib/theme";

export const metadata = {
  title: "Direction preview · Bidderly.win",
};

const order: ThemeId[] = ["brief", "console", "atelier"];

export default function DirectionPreviewPage() {
  return (
    <main className="min-h-screen bg-[#1f1d1a] text-[#f3eee2]">
      <div className="mx-auto max-w-[1480px] px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-10 flex flex-col gap-3 sm:mb-14">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#a39c8b]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d6cfba]" />
            design direction preview
          </div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Three ways to read the same radar.
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-[#cbc3b1]">
            Bidderly.win redesigned from scratch. Each frame below is the same dashboard, the
            same data, the same interaction model — interpreted through a different aesthetic
            vocabulary. Pick the one that feels right for DACH sales teams.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#a39c8b]">
            <span className="rounded-full border border-[#3a352c] px-3 py-1 font-mono uppercase tracking-[0.14em]">
              01 · brief
            </span>
            <span className="rounded-full border border-[#3a352c] px-3 py-1 font-mono uppercase tracking-[0.14em]">
              02 · console
            </span>
            <span className="rounded-full border border-[#3a352c] px-3 py-1 font-mono uppercase tracking-[0.14em]">
              03 · atelier
            </span>
            <Link
              href="/"
              className="ml-auto rounded-full border border-[#d6cfba] px-4 py-1.5 font-medium text-[#f3eee2] hover:bg-[#f3eee2] hover:text-[#1f1d1a]"
            >
              See the live site →
            </Link>
          </div>
        </header>

        <div className="space-y-10">
          {order.map((id) => {
            const meta = themes[id];
            return (
              <PreviewFrame
                key={id}
                id={id}
                label={`0${order.indexOf(id) + 1} · ${meta.label}`}
                description={meta.oneLiner}
              >
                <PreviewRadar theme={id} meta={meta} />
              </PreviewFrame>
            );
          })}
        </div>

        <footer className="mt-14 border-t border-[#3a352c] pt-6 text-[12px] text-[#a39c8b]">
          <p>
            The default theme applied to the live site is <span className="text-[#f3eee2]">Atelier</span>.
            A theme switcher is wired into the header on every page so the chosen direction can be
            flipped at any time.
          </p>
        </footer>
      </div>
    </main>
  );
}
