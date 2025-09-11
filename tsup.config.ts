import { defineConfig } from "tsup";

export default defineConfig([
    {
        entry: ["src/index.ts"],
        format: ["cjs", "esm"],
        dts: true,
        sourcemap: true,
    },
    {
        entry: ["src/index.ts"],
        format: ["iife"],
        globalName: "KaspaComSwapSdk",
        dts: false,
        sourcemap: true,
        target: "es2020",
        platform: "browser",
        outDir: "dist",
    },
]);
