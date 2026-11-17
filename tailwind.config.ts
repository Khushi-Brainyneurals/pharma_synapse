import type { Config } from "tailwindcss";

/*
 * PharmaSynapse colour families (Colour System v2). Each runs 50 to 950; raw values live in src/styles/global.css.
 * Tailwind's stock palettes are remapped onto these below, so existing classes such as
 * bg-emerald-100 or text-amber-700 render in the brand palette without touching components.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
/** A family whose shades read from CSS variables, so the navy theme can swap them. */
const family = (name: string) =>
  SHADES.reduce<Record<number, string>>((shades, s) => {
    shades[s] = `rgb(var(--${name}-${s}) / <alpha-value>)`;
    return shades;
  }, {});
const harbor = family("harbor");
const sage = family("sage");
const iris = family("iris");
const honey = family("honey");
const clay = family("clay");
const rose = family("rose");
const mist = family("mist");

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // `dark:` variants follow the navy theme switch.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Design system families by name.
        harbor,
        sage,
        iris,
        honey,
        clay,
        mist,
        // Stock Tailwind palettes mapped to their closest family.
        blue: harbor,
        sky: harbor,
        cyan: harbor,
        teal: harbor,
        indigo: iris,
        violet: iris,
        purple: iris,
        fuchsia: iris,
        emerald: sage,
        green: sage,
        lime: sage,
        amber: honey,
        yellow: honey,
        orange: clay,
        red: rose,
        rose,
        pink: rose,
        slate: mist,
        gray: mist,
        zinc: mist,
        neutral: mist,
        stone: mist,
        // Module map and sign-in tokens (from the landing design), themed in theme.css.
        page: "var(--lp-page)",
        card: "var(--lp-card)",
        inset: "var(--lp-inset)",
        paper: "var(--lp-paper)",
        "border-control": "var(--lp-border-control)",
        "text-2": "var(--lp-text-2)",
        "text-3": "var(--lp-text-3)",
        "primary-hover": "var(--lp-primary-hover)",
        "primary-soft": "var(--lp-primary-soft)",
        "on-primary": "var(--lp-on-primary)",
        accent: "var(--lp-accent)",
        "danger-text": "var(--lp-danger-text)",
        "fill-disabled": "var(--lp-fill-disabled)",
        "text-disabled": "var(--lp-text-disabled)",
        "chip-fill": "var(--lp-chip-fill)",
        "chip-rim": "var(--lp-chip-rim)",
        "glass-card": "var(--lp-glass-card)",
        "glass-rim": "var(--lp-glass-rim)",
        "soft-edge": "var(--lp-soft-edge)",
        "menu-icon": "var(--lp-menu-icon)",
        "focus-ring": "var(--lp-focus-ring)",
        toast: "var(--lp-toast)",
        background: "rgb(var(--color-background) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        subdued: "rgb(var(--color-subdued) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-dark": "rgb(var(--color-primary-dark) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        sunken: "var(--sunken)",
        "border-strong": "var(--line-strong)",
        "accent-soft": "var(--accent-soft)",
        "danger-soft": "var(--danger-soft)",
        "danger-ink": "var(--danger-ink)",
        draft: {
          fg: "var(--draft-fg)",
          bg: "var(--draft-bg)",
        },
        inreview: {
          fg: "var(--inreview-fg)",
          bg: "var(--inreview-bg)",
        },
        approved: {
          fg: "var(--approved-fg)",
          bg: "var(--approved-bg)",
        },
        superseded: {
          fg: "var(--superseded-fg)",
          bg: "var(--superseded-bg)",
        },
        rejected: {
          fg: "var(--rejected-fg)",
          bg: "var(--rejected-bg)",
        },
      },
      boxShadow: {
        card: "var(--lp-shadow-card)",
        "glass-card": "var(--lp-glass-highlight), var(--lp-shadow-card)",
        raised: "var(--lp-raised-md)",
        halo: "0 0 0 4px var(--lp-halo)",
        auth: "var(--shadow-auth)",
        overlay: "var(--shadow-overlay)",
        modal: "var(--shadow-modal)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
        pill: "var(--radius-pill)",
        panel: "var(--radius-panel)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        12: "var(--space-12)",
        "control-h": "var(--control-h)",
        "control-h-sm": "var(--control-h-sm)",
        "row-h": "var(--row-h)",
        "row-h-dense": "var(--row-h-dense)",
        "card-pad": "var(--card-pad)",
        "card-pad-tight": "var(--card-pad-tight)",
        "section-gap": "var(--section-gap)",
        "topbar-h": "var(--topbar-h)",
        "sidebar-w": "var(--sidebar-w)",
      },
      backdropBlur: {
        glass: "24px",
        frame: "28px",
      },
      transitionDuration: {
        1: "100ms",
        2: "160ms",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        icons: ["var(--font-icons)"],
      },
      fontSize: {
        h1: ["var(--fs-h1)", { lineHeight: "var(--lh-h1)" }],
        h2: ["var(--fs-h2)", { lineHeight: "var(--lh-h2)" }],
        h3: ["var(--fs-h3)", { lineHeight: "var(--lh-h3)" }],
        body: ["var(--fs-body)", { lineHeight: "var(--lh-body)" }],
        small: ["var(--fs-small)", { lineHeight: "var(--lh-small)" }],
        micro: ["var(--fs-micro)", { lineHeight: "var(--lh-micro)" }],
        overline: ["var(--fs-overline)", { lineHeight: "var(--lh-micro)" }],
        mono: ["var(--fs-mono)", { lineHeight: "var(--lh-mono)" }],
        "mono-sm": ["var(--fs-mono-sm)", { lineHeight: "var(--lh-mono)" }],
      },
      fontWeight: {
        regular: "var(--fw-regular)",
        medium: "var(--fw-medium)",
        semibold: "var(--fw-semibold)",
        bold: "var(--fw-bold)",
      },
      letterSpacing: {
        tight: "var(--tracking-tight)",
        overline: "var(--tracking-overline)",
      },
    },
  },
  plugins: [],
};

export default config;
