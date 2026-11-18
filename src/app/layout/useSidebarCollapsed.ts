import { useCallback, useState } from "react";
import { flushSync } from "react-dom";

const STORAGE_KEY = "ps-sidebar";

function readCollapsed(): boolean {
  return document.documentElement.dataset.sidebar === "collapsed";
}

/**
 * Collapsed side menu: the 64px icon rail from the design system.
 *
 * The state lives on <html data-sidebar="collapsed">, which sets --sidebar-w to 64px, so
 * every screen's grid column follows without per-page changes. index.html restores the
 * saved choice before first paint, and each page's sidebar reads it back from there.
 */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [isCollapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    const next = !readCollapsed();
    const root = document.documentElement;

    const apply = () => {
      if (next) {
        root.dataset.sidebar = "collapsed";
        root.classList.add("ps-rail-hold");
      } else {
        delete root.dataset.sidebar;
      }
      flushSync(() => setCollapsed(next));
    };

    try {
      localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }

    // Morph the menu and content as GPU snapshots rather than reflowing the page each
    // frame. Without View Transitions, or with reduced motion, it switches at once.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof document.startViewTransition === "function" && !prefersReducedMotion) {
      root.classList.add("ps-rail-morph");
      const transition = document.startViewTransition(apply);
      void transition.finished.finally(() => root.classList.remove("ps-rail-morph"));
    } else {
      apply();
    }
  }, []);

  return [isCollapsed, toggle];
}
