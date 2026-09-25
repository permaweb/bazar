import { defineConfig } from 'vitest/config';

import { sourceAliases } from './scripts/source-aliases';

export default defineConfig({
	resolve: { alias: sourceAliases, dedupe: ['react', 'react-dom'] },
	test: { include: ['tests/**/*.test.{ts,tsx,mjs}'] },
});
