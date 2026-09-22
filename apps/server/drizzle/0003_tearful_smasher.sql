CREATE TABLE "strategy_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_key" text NOT NULL,
	"execution_account" text NOT NULL,
	"session_date" text NOT NULL,
	"data_sha256" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strategy_runs_session_date" CHECK ("strategy_runs"."session_date" ~ '^[0-9]{8}$'),
	CONSTRAINT "strategy_runs_sha256" CHECK ("strategy_runs"."data_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_runs_account_key_idx" ON "strategy_runs" USING btree ("execution_account","run_key");