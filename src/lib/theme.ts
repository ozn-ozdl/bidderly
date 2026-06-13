export type ThemeId = "brief" | "console" | "atelier";

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  oneLiner: string;
  fonts: {
    display: string;
    body: string;
    mono: string;
  };
};

export const themes: Record<ThemeId, ThemeMeta> = {
  brief: {
    id: "brief",
    label: "Intelligence Brief",
    oneLiner: "Editorial. Newsroom. Bone, ink, signal red.",
    fonts: {
      display: "var(--font-display-brief)",
      body: "var(--font-body-brief)",
      mono: "var(--font-mono)",
    },
  },
  console: {
    id: "console",
    label: "Operations Console",
    oneLiner: "Mission control. Dark. Phosphor and signal.",
    fonts: {
      display: "var(--font-display-console)",
      body: "var(--font-body-console)",
      mono: "var(--font-mono)",
    },
  },
  atelier: {
    id: "atelier",
    label: "Atelier",
    oneLiner: "Premium craft. Cream, ink, moss. Quiet confidence.",
    fonts: {
      display: "var(--font-display-atelier)",
      body: "var(--font-body-atelier)",
      mono: "var(--font-mono)",
    },
  },
};

export const themeOrder: ThemeId[] = ["brief", "console", "atelier"];

export const defaultTheme: ThemeId = "atelier";
