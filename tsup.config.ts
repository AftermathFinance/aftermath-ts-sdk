import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "es2021",
  external: [
    "@mysten/sui",
    "bn.js",
    "dayjs",
    "node-fetch",
    "priority-queue-typescript",
  ],
});
