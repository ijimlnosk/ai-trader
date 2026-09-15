import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const restricted = (patterns) => ['error', { patterns }];
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/drizzle/meta/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'error', 'no-restricted-imports': restricted(['@ai-trader/*/src/**', '**/apps/*/src/**']) } },
  { files: ['apps/server/src/domain/**/*.ts'], rules: { 'no-restricted-imports': restricted(['fastify', 'drizzle-orm', 'drizzle-orm/*', 'pg', 'node:*', '**/application/**', '**/infrastructure/**', '**/interfaces/**', '**/app/**']) } },
  { files: ['apps/server/src/application/**/*.ts'], rules: { 'no-restricted-imports': restricted(['fastify', 'drizzle-orm', 'drizzle-orm/*', 'pg', '**/infrastructure/**', '**/interfaces/**', '**/app/**']) } },
);
