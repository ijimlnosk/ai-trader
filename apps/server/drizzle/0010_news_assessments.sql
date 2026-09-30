CREATE TABLE "news_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_date" text NOT NULL,
	"symbol" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"verdict" text,
	"assessment" jsonb,
	"reason" text,
	"article_count" integer NOT NULL,
	"input_sha256" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micro_usd" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_assessments_status" CHECK ("news_assessments"."status" IN ('assessed','unavailable','no_news','budget_exhausted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "news_assessments_session_symbol_idx" ON "news_assessments" USING btree ("session_date","symbol");