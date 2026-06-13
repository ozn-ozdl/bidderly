"use client";

import { useEffect } from "react";

const STORAGE_KEY = "bidderly:theme";

export function ThemeScript() {
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "brief" || stored === "console" || stored === "atelier") {
        document.documentElement.setAttribute("data-theme", stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}

export function setTheme(theme: "brief" | "console" | "atelier") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}
