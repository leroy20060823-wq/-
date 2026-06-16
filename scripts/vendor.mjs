// Copies the browser ESM builds of our frontend libraries into public/vendor/
// so the demo page can import them locally (no CDN). Re-run after bumping the
// marked / dompurify versions in package.json: `npm run vendor`.
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(root, "public", "vendor");

const files = [
  ["node_modules/marked/lib/marked.esm.js", "marked.esm.js"],
  ["node_modules/dompurify/dist/purify.es.mjs", "purify.es.mjs"],
];

await mkdir(vendorDir, { recursive: true });
for (const [from, to] of files) {
  await copyFile(join(root, from), join(vendorDir, to));
  console.log(`vendored ${to}`);
}
