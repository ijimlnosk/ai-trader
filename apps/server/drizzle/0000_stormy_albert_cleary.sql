CREATE TYPE "public"."order_side" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'submitted', 'filled', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."proposal_side" AS ENUM('BUY', 'SELL', 'HOLD');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"side" "order_side" NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"price" numeric(24, 8) NOT NULL,
	"currency" text NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"broker_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_quantity_positive" CHECK ("orders"."quantity" > 0),
	CONSTRAINT "order_price_positive" CHECK ("orders"."price" > 0),
	CONSTRAINT "order_currency_code" CHECK ("orders"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cash" numeric(24, 8) NOT NULL,
	"market_value" numeric(24, 8) NOT NULL,
	"total_equity" numeric(24, 8) NOT NULL,
	"currency" text NOT NULL,
	"realized_pnl" numeric(24, 8) NOT NULL,
	"unrealized_pnl" numeric(24, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshot_currency_code" CHECK ("portfolio_snapshots"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"average_price" numeric(24, 8) NOT NULL,
	"currency" text NOT NULL,
	"realized_pnl" numeric(24, 8) DEFAULT '0' NOT NULL,
	"unrealized_pnl" numeric(24, 8) DEFAULT '0' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "position_quantity_nonnegative" CHECK ("positions"."quantity" >= 0),
	CONSTRAINT "position_average_price_nonnegative" CHECK ("positions"."average_price" >= 0),
	CONSTRAINT "position_time_order" CHECK ("positions"."closed_at" IS NULL OR "positions"."closed_at" >= "positions"."opened_at"),
	CONSTRAINT "position_currency_code" CHECK ("positions"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "trade_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"side" "proposal_side" NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"confidence" numeric(5, 4) NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"risk" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_score_range" CHECK ("trade_proposals"."score" BETWEEN 0 AND 100),
	CONSTRAINT "proposal_confidence_range" CHECK ("trade_proposals"."confidence" BETWEEN 0 AND 1)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_proposal_id_trade_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."trade_proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_proposal_id_idx" ON "orders" USING btree ("proposal_id");