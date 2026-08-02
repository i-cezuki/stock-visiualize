import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        category: {
          liquid: "#5B3714",
          tube: "#8A9A3B",
          jar: "#B23A2E",
          powder: "#E4D6A7",
          spice: "#C97A2B",
        },
        cream: "#F5EFE6",
      },
      borderRadius: {
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
