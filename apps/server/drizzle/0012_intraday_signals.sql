CREATE TABLE "intraday_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"session_date" text NOT NULL,
	"rule" text NOT NULL,
	"average_price" numeric(24, 8) NOT NULL,
	"price" numeric(24, 8) NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"gain_bps" integer NOT NULL,
	"quote_at" timestamp with time zone NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	CONSTRAINT "intraday_signals_rule" CHECK ("intraday_signals"."rule" IN ('TAKE_PROFIT_30'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "intraday_signals_symbol_session_rule_idx" ON "intraday_signals" USING btree ("symbol","session_date","rule");