import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
