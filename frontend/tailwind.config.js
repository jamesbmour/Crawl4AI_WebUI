/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#f97316",
          hover: "#fb923c",
          muted: "#7c2d12",
        },
        surface: {
          DEFAULT: "#0c0c0e",
          raised: "#141417",
          overlay: "#1c1c21",
          border: "#27272d",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
