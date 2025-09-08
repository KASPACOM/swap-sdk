// scripts/rename-cjs.js
import { readdirSync, renameSync } from "fs";
import { join } from "path";

const cjsDir = join(process.cwd(), "dist", "cjs");

for (const file of readdirSync(cjsDir)) {
  if (file.endsWith(".js")) {
    const oldPath = join(cjsDir, file);
    const newPath = join(cjsDir, file.replace(/\.js$/, ".cjs"));
    renameSync(oldPath, newPath);
    console.log(`Renamed: ${file} -> ${file.replace(/\.js$/, ".cjs")}`);
  }
}
