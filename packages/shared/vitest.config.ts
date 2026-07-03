import { defineConfig } from 'vitest/config';

// Shared package holds pure, platform-agnostic logic — no DOM, no React. A plain node
// environment is enough. Tests live in __tests__/ (mirrors apps/web).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
