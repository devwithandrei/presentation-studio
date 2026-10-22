"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  function syncTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    buttonRef.current?.setAttribute("aria-label", label);
    buttonRef.current?.setAttribute("title", label);
  }

  useEffect(() => {
    syncTheme(currentTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = (event: MediaQueryListEvent) => {
      if (window.localStorage.getItem("presentation-studio:theme")) return;
      syncTheme(event.matches ? "dark" : "light");
    };
    const syncOtherTab = (event: StorageEvent) => {
      if (event.key !== "presentation-studio:theme" || (event.newValue !== "light" && event.newValue !== "dark")) return;
      syncTheme(event.newValue);
    };
    media.addEventListener("change", syncSystemTheme);
    window.addEventListener("storage", syncOtherTab);
    return () => {
      media.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("storage", syncOtherTab);
    };
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = currentTheme() === "dark" ? "light" : "dark";
    syncTheme(nextTheme);
    window.localStorage.setItem("presentation-studio:theme", nextTheme);
  }

  return (
    <button ref={buttonRef} className="theme-toggle" type="button" aria-label="Switch theme to the other color mode" title="Switch theme to the other color mode" onClick={toggleTheme}>
      <Moon className="theme-icon-moon" size={16} aria-hidden="true" />
      <Sun className="theme-icon-sun" size={16} aria-hidden="true" />
    </button>
  );
}
