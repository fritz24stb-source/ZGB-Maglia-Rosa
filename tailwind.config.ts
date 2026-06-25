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
          50: "#f6f7f8",
          100: "#eceff1",
          200: "#d6dce1",
          300: "#b4bec8",
          400: "#8b9aaa",
          500: "#68798b",
          600: "#536274",
          700: "#444f5f",
          800: "#3b4450",
          900: "#252b33",
        },
        signal: {
          green: "#0f8f5f",
          amber: "#b8750b",
          red: "#c24135",
          blue: "#2563eb",
        },
      },
      boxShadow: {
        line: "0 1px 0 rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
