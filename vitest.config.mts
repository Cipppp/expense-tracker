import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Testul de izolare scrie in baza; rulat in paralel cu el insusi, s-ar
    // calca pe randuri. Restul sunt functii pure si n-au de ce sa se atinga.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "server-only": r("./test/server-only-stub.ts"),
      "@": r("./src"),
    },
  },
});
