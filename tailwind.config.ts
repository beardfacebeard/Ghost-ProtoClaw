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
        // ── Legacy palette ─────────────────────────────────────────
        // Still consumed by pages not yet migrated to the 2026 redesign
        // tokens. Kept intact during the migration so existing UI keeps
        // rendering while we sweep pages one at a time.
        ghost: {
          black: "#0a0a0a",
          base: "#0d0d0d",
          surface: "#1a1a1a",
          raised: "#222222",
          border: "#2a2a2a",
          "border-strong": "#333333",
          "nav-active": "#1e2230"
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
        },

        // ── 2026 redesign tokens ───────────────────────────────────
        // Quiet Luxury × Cinematic Dark hybrid. Black + steel gray +
        // steel blue. Use these for all NEW UI. Existing pages migrate
        // one at a time.
        bg: {
          app: "#08090B",
          surface: "#101217",
          "surface-2": "#161922",
          "surface-3": "#1E2230"
        },
        line: {
          subtle: "#1F232C",
          DEFAULT: "#2A2F3A",
          strong: "#3A4150"
        },
        ink: {
          primary: "#F2F4F8",
          secondary: "#8B93A3",
          muted: "#5C6475",
          disabled: "#3B4050"
        },
        steel: {
          DEFAULT: "#5B7FB0",
          bright: "#7FA1D1",
          deep: "#3B5F8F"
        },
        state: {
          success: "#4A9C7F",
          warning: "#B8925A",
          danger: "#B85A5A",
          ai: "#8A7FC4"
        }
      },
      fontFamily: {
        // Geist is the new primary. Outfit kept as a fallback so any
        // component not yet migrated still has its weight stack.
        sans: [
          "var(--font-geist-sans)",
          "var(--font-outfit)",
          "system-ui",
          "sans-serif"
        ],
        display: [
          "var(--font-clash-grotesk)",
          "var(--font-geist-sans)",
          "system-ui",
          "sans-serif"
        ],
        mono: [
          "var(--font-geist-mono)",
          "var(--font-mono)",
          "Fira Code",
          "monospace"
        ]
      },
      backgroundImage: {
        // Legacy
        "ghost-gradient":
          "linear-gradient(135deg, #0a0a0a 0%, #0f0f0f 100%)",
        "brand-glow":
          "radial-gradient(circle, rgba(230,57,70,0.15) 0%, transparent 70%)",
        // 2026 — subtle ambient shift used behind hero / empty states
        "steel-glow":
          "radial-gradient(ellipse at top right, rgba(91, 127, 176, 0.08), transparent 60%)"
      },
      boxShadow: {
        // Legacy
        brand: "0 0 20px rgba(230, 57, 70, 0.2)",
        "brand-sm": "0 0 10px rgba(230, 57, 70, 0.15)",
        surface: "0 1px 3px rgba(0, 0, 0, 0.4)",
        // 2026 — steel accent glow for active / hover / focus
        steel: "0 0 20px rgba(91, 127, 176, 0.25)",
        "steel-sm": "0 0 8px rgba(91, 127, 176, 0.35)",
        // Card elevation — used sparingly; prefer border weight
        card: "0 1px 2px rgba(0, 0, 0, 0.6), 0 0 0 1px #1F232C"
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
        },
        // 2026 — "breathing" pulse for live indicators (running agents,
        // online status). Steel-blue halo expands + fades. Subtle.
        "pulse-steel": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(91, 127, 176, 0.4)"
          },
          "50%": {
            boxShadow: "0 0 0 6px rgba(91, 127, 176, 0)"
          }
        },
        // 2026 — very slow gradient drift used behind hero panels.
        // Signals "something is alive in here" without being noisy.
        "ambient-drift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        },
        // 2026 — horizontal scan line that moves across a loading bar.
        // Used for skeleton loaders and "thinking" states.
        "scan-line": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        },
        // 2026 — soft upward fade-in for panels that appear after
        // data loads. Keep duration tight (200ms) so it doesn't feel
        // sluggish.
        "fade-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "pulse-brand": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // 2026 motion tokens
        "pulse-steel": "pulse-steel 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "ambient-drift": "ambient-drift 12s ease-in-out infinite",
        "scan-line": "scan-line 1.8s ease-in-out infinite",
        "fade-up": "fade-up 0.2s ease-out"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;

export default config;
