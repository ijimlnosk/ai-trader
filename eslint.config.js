import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const restricted = (patterns) => ['error', { patterns }];
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/drizzle/meta/**', '**/.next/**', '**/next-env.d.ts', '.agents/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-explicit-any': 'error', 'no-restricted-imports': restricted(['@ai-trader/*/src/**', '**/apps/*/src/**']) } },
  { files: ['apps/server/src/domain/**/*.ts'], rules: { 'no-restricted-imports': restricted(['fastify', 'drizzle-orm', 'drizzle-orm/*', 'pg', 'node:*', '**/application/**', '**/infrastructure/**', '**/interfaces/**', '**/app/**']) } },
  // The web console reaches the server only through HTTP and shared contracts.
  { files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'], rules: { 'no-restricted-imports': restricted(['@ai-trader/*/src/**', '**/apps/*/src/**', '**/apps/server/**', '**/server/src/**', 'drizzle-orm', 'pg', 'fastify']) } },
  // Offline research scripts run under Node.
  { files: ['research/**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', URLSearchParams: 'readonly', setTimeout: 'readonly' } } },
  { files: ['apps/server/src/application/**/*.ts'], rules: { 'no-restricted-imports': restricted(['fastify', 'drizzle-orm', 'drizzle-orm/*', 'pg', '**/infrastructure/**', '**/interfaces/**', '**/app/**']) } },
);
