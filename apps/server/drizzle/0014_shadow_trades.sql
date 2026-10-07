CREATE TABLE "shadow_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy" text NOT NULL,
	"session_date" text NOT NULL,
	"symbol" text NOT NULL,
	"side" "order_side" NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"quote_price" numeric(24, 8) NOT NULL,
	"fill_price" numeric(24, 8) NOT NULL,
	"fees_krw" numeric(24, 8) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "shadow_trades_strategy_created_idx" ON "shadow_trades" USING btree ("strategy","created_at");