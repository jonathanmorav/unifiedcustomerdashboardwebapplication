import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/v0/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Cakewalk-specific colors
        "cakewalk-primary": "hsl(var(--cakewalk-primary))",
        "cakewalk-primary-light": "hsl(var(--cakewalk-primary-light))",
        "cakewalk-primary-dark": "hsl(var(--cakewalk-primary-dark))",
        "cakewalk-primary-royal": "hsl(var(--cakewalk-primary-royal))",
        "cakewalk-success": "hsl(var(--cakewalk-success))",
        "cakewalk-success-light": "hsl(var(--cakewalk-success-light))",
        "cakewalk-success-dark": "hsl(var(--cakewalk-success-dark))",
        "cakewalk-error": "hsl(var(--cakewalk-error))",
        "cakewalk-warning": "hsl(var(--cakewalk-warning))",
        "cakewalk-alice-100": "hsl(var(--cakewalk-bg-alice-100))",
        "cakewalk-alice-200": "hsl(var(--cakewalk-bg-alice-200))",
        "cakewalk-alice-300": "hsl(var(--cakewalk-bg-alice-300))",
        "cakewalk-border": "hsl(var(--cakewalk-border))",
        "cakewalk-text-primary": "hsl(var(--cakewalk-text-primary))",
        "cakewalk-text-secondary": "hsl(var(--cakewalk-text-secondary))",
        "cakewalk-text-tertiary": "hsl(var(--cakewalk-text-tertiary))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        "dm-sans": ["DM Sans", "sans-serif"],
        "space-grotesk": ["Space Grotesk", "sans-serif"],
      },
      fontSize: {
        // Cakewalk typography scale
        "cakewalk-h1": ["48px", { lineHeight: "56px", fontWeight: "700" }],
        "cakewalk-h2": ["36px", { lineHeight: "44px", fontWeight: "700" }],
        "cakewalk-h3": ["28px", { lineHeight: "36px", fontWeight: "600" }],
        "cakewalk-h4": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "cakewalk-h5": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "cakewalk-body": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "cakewalk-body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "cakewalk-body-xs": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "cakewalk-body-xxs": ["12px", { lineHeight: "16px", fontWeight: "400" }],
      },
      boxShadow: {
        "cakewalk-light": "0 1px 3px rgba(52, 89, 183, 0.06)",
        "cakewalk-medium": "0 4px 12px rgba(52, 89, 183, 0.08)",
        "cakewalk-heavy": "0 8px 24px rgba(52, 89, 183, 0.12)",
        "cakewalk-hover": "0 8px 16px rgba(52, 89, 183, 0.16)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config