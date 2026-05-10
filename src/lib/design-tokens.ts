/**
 * Probix design tokens - analytical SaaS palette (Stripe/Linear lineage).
 * CSS variables mirror these in app/globals.css for Tailwind consumption.
 */

export const colors = {
  background: {
    main: "#0B1020",
    secondary: "#111827",
    elevated: "#1A2236",
  },
  text: {
    primary: "#F8FAFC",
    secondary: "#94A3B8",
    muted: "#64748B",
  },
  brand: {
    primary: "#3B82F6",
    primaryHover: "#2563EB",
    purple: "#8B5CF6",
  },
  semantic: {
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
  },
  borders: {
    default: "rgba(255, 255, 255, 0.06)",
  },
  overlays: {
    cardSurface: "rgba(17, 24, 39, 0.75)",
  },
} as const;

export const gradients = {
  hero: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.08))",
  heroSubtleMesh:
    "radial-gradient(ellipse 120% 80% at 50% -40%, rgba(59,130,246,0.12), transparent 55%)",
  purpleGlow: "radial-gradient(circle at 80% 20%, rgba(139,92,246,0.07), transparent 45%)",
} as const;

export const radii = {
  card: "24px",
  button: "12px",
  input: "10px",
  badge: "8px",
} as const;

export const shadows = {
  card:
    "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px -12px rgba(0,0,0,0.55)",
  cardHover:
    "0 1px 0 rgba(255,255,255,0.06) inset, 0 14px 40px -14px rgba(59,130,246,0.15)",
  soft: "0 4px 24px -8px rgba(0,0,0,0.4)",
  button: "0 1px 2px rgba(0,0,0,0.25)",
} as const;

/** Spacing scale (px → rem implied in Tailwind spacing config) - generous SaaS rhythm */
export const spacing = {
  xs: "0.5rem",
  sm: "0.75rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
  "3xl": "4rem",
  "4xl": "6rem",
  sectionY: "5rem",
  sectionYMobile: "3.5rem",
  containerPad: "1.5rem",
  gridGap: "1.5rem",
} as const;

export const typography = {
  fontFamilies: {
    sans: '"Inter", system-ui, sans-serif',
  },
  letterSpacing: {
    tightest: "-0.03em",
    tight: "-0.022em",
    normal: "-0.011em",
  },
  sizes: {
    hero: ["2.75rem", "4rem"], // clamp via utilities
    h1: ["2rem", "2.75rem"],
    h2: ["1.5rem", "2rem"],
    h3: ["1.125rem", "1.375rem"],
    body: ["0.9375rem", "1rem"],
    small: ["0.8125rem", "0.875rem"],
    caption: ["0.75rem", "0.8125rem"],
  },
} as const;

export const transitions = {
  default: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  slow: "320ms cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/** Framer Motion presets - import in client wrappers only */
export const motionReduced = "(prefers-reduced-motion: reduce)";
