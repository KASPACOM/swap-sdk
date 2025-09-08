// scripts/rename-cjs.js
import { readdirSync, renameSync, statSync } from "fs";
import { join, extname } from "path";

function renameRecursive(dir) {
  for (const file of readdirSync(dir)) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      renameRecursive(fullPath);
    } else if (extname(file) === ".js") {
      const newPath = fullPath.replace(/\.js$/, ".cjs");
      renameSync(fullPath, newPath);
      console.log(`Renamed: ${fullPath} -> ${newPath}`);
    }
  }
}

renameRecursive(join(process.cwd(), "dist", "cjs"));
