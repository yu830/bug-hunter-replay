import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['reports/**/*.spec.ts'],
  testIgnore: ['dist/**', 'node_modules/**']
});
