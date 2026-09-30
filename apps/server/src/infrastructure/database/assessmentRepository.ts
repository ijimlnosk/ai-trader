import { and, eq } from 'drizzle-orm';
import type { AssessmentRecord, AssessmentRepository } from '../../application/analysis/screen.ts';
import { newsAssessmentSchema } from '../../application/analysis/ports.ts';
import type { createDatabase } from './index.ts';
import { newsAssessments as table } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

function map(row: typeof table.$inferSelect): AssessmentRecord {
  const assessment = row.assessment === null ? null : newsAssessmentSchema.parse(row.assessment);
  return { sessionDate: row.sessionDate, symbol: row.symbol, model: row.model, status: row.status as AssessmentRecord['status'],
    verdict: assessment?.verdict ?? null, assessment, reason: row.reason, articleCount: row.articleCount, inputSha256: row.inputSha256,
    inputTokens: row.inputTokens, outputTokens: row.outputTokens, costMicroUsd: row.costMicroUsd };
}

export function createAssessmentRepository(db: Database): AssessmentRepository {
  return {
    async find(sessionDate, symbol) {
      const [row] = await db.select().from(table).where(and(eq(table.sessionDate, sessionDate), eq(table.symbol, symbol)));
      return row ? map(row) : null;
    },
    async save(record) {
      await db.insert(table).values(record).onConflictDoNothing();
    },
    async listForSession(sessionDate) {
      return (await db.select().from(table).where(eq(table.sessionDate, sessionDate))).map(map);
    },
  };
}
