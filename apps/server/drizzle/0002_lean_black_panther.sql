CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"execution_account" text NOT NULL,
	"symbol" text NOT NULL,
	"side" "order_side" NOT NULL,
	"trade_date" text NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"amount" numeric(24, 8) NOT NULL,
	"cumulative_quantity" numeric(24, 8) NOT NULL,
	"cumulative_amount" numeric(24, 8) NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'reconciliation' NOT NULL,
	CONSTRAINT "execution_positive" CHECK ("executions"."quantity" > 0 AND "executions"."amount" > 0 AND "executions"."quantity" = trunc("executions"."quantity")),
	CONSTRAINT "execution_cumulative_range" CHECK ("executions"."cumulative_quantity" >= "executions"."quantity" AND "executions"."cumulative_amount" >= "executions"."amount"),
	CONSTRAINT "execution_trade_date" CHECK ("executions"."trade_date" ~ '^[0-9]{8}$'),
	CONSTRAINT "execution_source" CHECK ("executions"."source" IN ('reconciliation', 'legacy_order_backfill'))
);
--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "executions_order_cumulative_idx" ON "executions" USING btree ("order_id","cumulative_quantity");--> statement-breakpoint
CREATE INDEX "executions_account_date_idx" ON "executions" USING btree ("execution_account","trade_date");--> statement-breakpoint
-- Preserve existing confirmed cumulative amounts without inventing individual exchange fills.
-- Incomplete/invalid historical records deliberately remain uncovered and fail ledger reads.
INSERT INTO executions (order_id, execution_account, symbol, side, trade_date,
  quantity, amount, cumulative_quantity, cumulative_amount, observed_at, source)
SELECT id, execution_account, symbol, side, broker_order_date,
  filled_quantity, filled_amount, filled_quantity, filled_amount, updated_at, 'legacy_order_backfill'
FROM orders
WHERE execution_account IS NOT NULL AND broker_order_id IS NOT NULL
  AND broker_order_date ~ '^[0-9]{8}$' AND filled_quantity > 0 AND filled_amount > 0
  AND filled_quantity = trunc(filled_quantity);
