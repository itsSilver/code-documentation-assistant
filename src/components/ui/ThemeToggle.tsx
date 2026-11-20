"use client";

import { Moon, Sun } from "@/components/ui/Icons";

const root = () => document.documentElement;

/**
 * Follows the OS theme until the user picks one; the choice is remembered. The saved choice is
 * applied before paint by the script in the root layout, so there is no flash.
 */
export function ThemeToggle() {
  function toggle() {
    const dark =
      root().dataset.theme === "dark" ||
      (!root().dataset.theme && matchMedia?.("(prefers-color-scheme: dark)").matches);
    const next = dark ? "light" : "dark";
    root().dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be blocked; the toggle still works for this page view.
    }
  }

  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label="Toggle dark mode">
      <Sun className="only-dark" />
      <Moon className="only-light" />
    </button>
  );
}
