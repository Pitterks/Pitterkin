import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    env: {
      DATABASE_URL: "postgres://shop:shop@localhost:5432/shop_test",
      ENCRYPTION_KEY: "0".repeat(64),
      AUTH_SECRET: "test-secret",
      ADMIN_PASSWORD: "test",
      APP_URL: "http://localhost:3000",
    },
    fileParallelism: false,
  },
});
