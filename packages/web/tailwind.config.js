/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        foreground: "#FFFFFF",
        card: "#12121A",
        primary: "#6C5CE7",
        secondary: "#A29BFE",
        muted: "#1A1A2E",
        accent: "#00D2FF",
        success: "#00E676",
        warning: "#FFD600",
        danger: "#FF5252",
        border: "#1E1E2E"
      },
    },
  },
  plugins: [],
};