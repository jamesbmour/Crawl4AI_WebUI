/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#ffa180",
          hover: "#ffb99f",
          muted: "#59352d",
        },
        surface: {
          DEFAULT: "#10141c",
          raised: "#171d28",
          overlay: "#202837",
          border: "#303a4b",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
