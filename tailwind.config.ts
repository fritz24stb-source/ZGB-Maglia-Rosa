import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        asphalt: {
          50: "#f7f1e8",
          100: "#ecdeca",
          200: "#d8c6ac",
          300: "#c7b79f",
          400: "#9a8a74",
          500: "#756856",
          600: "#564e4c",
          700: "#4a4240",
          800: "#3f3937",
          900: "#3b3634",
        },
        signal: {
          green: "#3a8b5b",
          amber: "#8a5b20",
          red: "#962317",
          blue: "#004225",
        },
      },
      boxShadow: {
        line: "0 1px 0 rgba(59, 54, 52, 0.08)",
        panel: "0 18px 48px rgba(59, 54, 52, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
