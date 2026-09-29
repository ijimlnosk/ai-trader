CREATE TABLE "paper_loop_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_account" text NOT NULL,
	"run_key" text NOT NULL,
	"order_key" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'CLAIMED' NOT NULL,
	"result" jsonb,
	"order_snapshot" jsonb,
	"reason" text,
	"deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "paper_loop_status" CHECK ("paper_loop_runs"."status" IN ('CLAIMED','TRACKING','COMPLETE','HALTED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "paper_loop_account_run_idx" ON "paper_loop_runs" USING btree ("execution_account","run_key");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_loop_account_order_idx" ON "paper_loop_runs" USING btree ("execution_account","order_key");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_loop_account_active_idx" ON "paper_loop_runs" USING btree ("execution_account") WHERE "paper_loop_runs"."status" <> 'COMPLETE';