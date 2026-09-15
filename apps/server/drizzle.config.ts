import { defineConfig } from 'drizzle-kit';

// Generation is offline. Applying migrations uses the explicit db:migrate command.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/database/schema.ts',
  out: './drizzle',
});
