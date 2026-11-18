import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";

type Theme = "light" | "navy";

const STORAGE_KEY = "ps-theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "navy" : "light";
}

/**
 * The one theme button: flips light glass and navy, and remembers the choice.
 * index.html applies the stored theme before React mounts, so there is no flash.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const isNavy = theme === "navy";
  const nextLabel = isNavy ? "Switch to light theme" : "Switch to navy theme";

  function toggle() {
    const next: Theme = isNavy ? "light" : "navy";
    const root = document.documentElement;

    const apply = () => {
      if (next === "navy") {
        root.dataset.theme = "dark";
      } else {
        delete root.dataset.theme;
      }
      // Update the icon synchronously so it lands in the same frame as the new colours.
      flushSync(() => setTheme(next));
    };

    try {
      localStorage.setItem(STORAGE_KEY, next === "navy" ? "dark" : "light");
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }

    // Crossfade the whole page as one GPU layer: the browser snapshots the old and new
    // look and fades between them, instead of animating every element (which stutters,
    // and can't fade the glows or the glass blur anyway). Browsers without View
    // Transitions, and people who prefer reduced motion, get an instant switch.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition === "function" && !prefersReducedMotion) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }

  return (
    <button
      type="button"
      className="ps-chip-button"
      aria-label={nextLabel}
      aria-pressed={isNavy}
      title={nextLabel}
      onClick={toggle}
    >
      {isNavy ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
    </button>
  );
}
