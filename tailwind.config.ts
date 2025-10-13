import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0F172A",
          foreground: "#F8FAFC",
        },
        accent: {
          DEFAULT: "#2563EB",
          foreground: "#F8FAFC",
        },
      },
      boxShadow: {
        card: "0 10px 30px -15px rgba(15, 23, 42, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
