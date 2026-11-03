import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#142B4A", secondary: "#203E63" },
        brand: { DEFAULT: "#3478D4", light: "#EAF2FC" },
        surface: "#FFFFFF",
        canvas: "#F5F7FA",
        ink: { DEFAULT: "#182230", muted: "#64748B" },
        line: "#E5EAF0",
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
