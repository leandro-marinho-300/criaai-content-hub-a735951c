import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const serverDir = join(process.cwd(), "dist", "server");
const files = await readdir(serverDir);
const productionManifest = files.find(
  (file) => /^_tanstack-start-manifest_v-.+\.mjs$/.test(file),
);

if (!productionManifest) {
  throw new Error("Production TanStack Start manifest was not generated.");
}

const manifestContent = await readFile(join(serverDir, productionManifest), "utf8");

if (manifestContent.includes("tanstack-start-dev-client-entry")) {
  throw new Error("Production TanStack Start manifest still references the dev client.");
}

await writeFile(
  join(serverDir, "_tanstack-start-manifest_v.mjs"),
  `export { tsrStartManifest } from "./${productionManifest}";\n`,
);