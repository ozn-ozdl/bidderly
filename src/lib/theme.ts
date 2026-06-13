export type ThemeId = "atelier";

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

export const themeOrder: ThemeId[] = ["atelier"];

export const defaultTheme: ThemeId = "atelier";
