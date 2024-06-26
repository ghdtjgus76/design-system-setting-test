import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./app/**/*.{ts,tsx,js,jsx}"],
  exclude: [],
  outdir: "styled-system",
});
