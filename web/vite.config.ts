import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { defineConfig } from "vitest/config";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// snarkjs / ffjavascript y @stellar/stellar-sdk asumen builtins de Node (buffer, process,
// crypto, stream…). nodePolyfills los provee en el navegador para que la prueba ZK y las
// llamadas a Stellar funcionen en el cliente.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  envDir: repoRoot,
  server: { port: 5173 },
  optimizeDeps: {
    exclude: ["snarkjs"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
