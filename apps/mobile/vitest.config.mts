import { defineConfig } from "vitest/config";

// Only pure logic in src/lib is unit-tested; nothing here imports react-native.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
