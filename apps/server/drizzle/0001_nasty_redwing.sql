CREATE TABLE "order_fills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"filled_quantity" numeric(24, 8) NOT NULL,
	"filled_amount" numeric(24, 8) NOT NULL,
	"broker_status" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "execution_account" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "request_payload" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "requested_price" numeric(24, 8);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_type" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "risk_status" "proposal_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "risk_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "risk_audit" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "broker_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "broker_order_date" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "filled_quantity" numeric(24, 8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "filled_amount" numeric(24, 8) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "positions_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "failure_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "execution_account" text;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_fills" ADD CONSTRAINT "order_fills_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_fills_snapshot_idx" ON "order_fills" USING btree ("order_id","filled_quantity","filled_amount","broker_status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_execution_key_idx" ON "orders" USING btree ("execution_account","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_broker_identity_idx" ON "orders" USING btree ("execution_account","broker_order_date","broker_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_one_unresolved_per_account_idx" ON "orders" USING btree ("execution_account") WHERE 
    "orders"."broker_status" IN ('PREPARING','SUBMITTING','UNKNOWN','SUBMITTED','PARTIALLY_FILLED') OR
    ("orders"."broker_status" IN ('FILLED','CANCELLED') AND "orders"."positions_synced_at" IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "positions_execution_symbol_idx" ON "positions" USING btree ("execution_account","symbol");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_fill_range" CHECK ("orders"."filled_quantity" >= 0 AND "orders"."filled_quantity" <= "orders"."quantity" AND "orders"."filled_amount" >= 0);