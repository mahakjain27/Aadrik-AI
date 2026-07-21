/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/website/**/*.{js,jsx,ts,tsx}",
  ],
  // Scoped so the utility-class layer can never collide with Bootstrap's
  // (both ship bare classes like .border/.rounded/.shadow) on the existing
  // dashboard, and preflight is off so Tailwind never resets global tag
  // styles (headings, buttons, forms) that Bootstrap already normalizes.
  prefix: "tw-",
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        aadrik: {
          charcoal: "#221f1f",
          wine: "#5c1030",
          wineDeep: "#3a0c1f",
          wineLight: "#6d1836",
          cream: "#f6e3e7",
        },
      },
      fontFamily: {
        display: ["'Inter'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "aadrik-card": "0 4px 16px rgba(92, 16, 48, 0.10), 0 1px 3px rgba(92, 16, 48, 0.08)",
        "aadrik-lift": "0 20px 40px rgba(34, 31, 31, 0.14), 0 4px 10px rgba(92, 16, 48, 0.10)",
      },
      backgroundImage: {
        "aadrik-ombre": "linear-gradient(180deg, #221f1f 0%, #4a0f28 60%, #6d1836 100%)",
        "aadrik-ombre-diag": "linear-gradient(135deg, #221f1f 0%, #4a0f28 55%, #6d1836 100%)",
      },
      animation: {
        "fade-up": "aadrik-fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "aadrik-float 6s ease-in-out infinite",
      },
      keyframes: {
        "aadrik-fade-up": {
          "0%": { opacity: 0, transform: "translateY(24px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "aadrik-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
}