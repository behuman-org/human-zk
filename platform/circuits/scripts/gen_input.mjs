// Genera platform/circuits/input.json para post.circom.
// Uso: node scripts/gen_input.mjs [contentHashDecimal]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contentHash = process.argv[2] ?? "0"; // 0 = registrar identidad (sin contenido)
const input = {
  birthYear: "1995",
  countryCode: "32",
  secret: "987654321098765432109876543210",
  pathElements: ["11111111111111111111", "22222222222222222222", "33333333333333333333", "44444444444444444444"],
  pathIndices: ["0", "1", "0", "1"],
  contentHash: String(contentHash),
};
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "..", "input.json"), JSON.stringify(input, null, 2) + "\n");
console.log("OK input.json:", JSON.stringify(input));
