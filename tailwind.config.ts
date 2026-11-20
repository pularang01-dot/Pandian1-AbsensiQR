import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#142B4A", secondary: "#203E63" },
        brand: { DEFAULT: "#3478D4", light: "rgb(var(--c-brand-light) / <alpha-value>)" },
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        ink: { DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", muted: "rgb(var(--c-ink-muted) / <alpha-value>)" },
        line: "rgb(var(--c-line) / <alpha-value>)",
        success: "#16865B",
        warning: "#D99124",
        danger: "#D64B4B",
        info: "#3985C8",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,43,74,0.04), 0 1px 3px rgba(20,43,74,0.06)",
        pop: "0 8px 24px rgba(20,43,74,0.12)",
      },
      borderRadius: { xl: "0.875rem" },
    },
  },
  plugins: [],
};

export default config;