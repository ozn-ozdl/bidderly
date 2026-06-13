"use client";

import { useEffect } from "react";

const STORAGE_KEY = "bidderly:theme";

export function ThemeScript() {
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "atelier");
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("data-theme", "atelier");
  }, []);

  return null;
}
