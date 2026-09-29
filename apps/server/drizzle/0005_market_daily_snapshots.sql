CREATE TABLE "market_daily_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"through" text NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"calendar_version" text NOT NULL,
	"raw_sha256" text NOT NULL,
	"dataset" jsonb NOT NULL,
	"dataset_sha256" text NOT NULL,
	"candles_sha256" text NOT NULL,
	"revised_dates" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_daily_snapshot_symbol" CHECK ("market_daily_snapshots"."symbol" ~ '^[0-9]{6}$'),
	CONSTRAINT "market_daily_snapshot_through" CHECK ("market_daily_snapshots"."through" ~ '^[0-9]{8}$'),
	CONSTRAINT "market_daily_snapshot_sha256" CHECK ("market_daily_snapshots"."raw_sha256" ~ '^[0-9a-f]{64}$' AND "market_daily_snapshots"."dataset_sha256" ~ '^[0-9a-f]{64}$' AND "market_daily_snapshots"."candles_sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "market_daily_snapshot_data_idx" ON "market_daily_snapshots" USING btree ("symbol","through","candles_sha256");--> statement-breakpoint
CREATE INDEX "market_daily_snapshot_latest_idx" ON "market_daily_snapshots" USING btree ("symbol","through","created_at");