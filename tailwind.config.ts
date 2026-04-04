import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./prisma/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1440px"
      }
    },
    extend: {
      colors: {
        ghost: {
          black: "#0a0a0a",
          base: "#0d0d0d",
          surface: "#1a1a1a",
          raised: "#222222",
          border: "#2a2a2a",
          "border-strong": "#333333",
          "nav-active": "#2a1212"
        },
        brand: {
          primary: "#e63946",
          "primary-hover": "#cc2d38",
          cyan: "#00b4d8",
          amber: "#f59e0b"
        },
        status: {
          active: "#10b981",
          info: "#3b82f6",
          warning: "#f59e0b",
          error: "#e63946"
        }
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Fira Code", "monospace"]
      },
      backgroundImage: {
        "ghost-gradient": "linear-gradient(135deg, #0a0a0a 0%, #0f0f0f 100%)",
        "brand-glow": "radial-gradient(circle, rgba(230,57,70,0.15) 0%, transparent 70%)"
      },
      boxShadow: {
        brand: "0 0 20px rgba(230, 57, 70, 0.2)",
        "brand-sm": "0 0 10px rgba(230, 57, 70, 0.15)",
        surface: "0 1px 3px rgba(0, 0, 0, 0.4)"
      },
      borderRadius: {
        "3xl": "0.5rem",
        "2xl": "0.5rem",
        xl: "0.375rem",
        lg: "0.25rem",
        md: "0.1875rem",
        sm: "0.125rem"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      },
      animation: {
        "pulse-brand": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;

export default config;
