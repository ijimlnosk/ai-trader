CREATE TABLE "market_minute_bars" (
	"symbol" text NOT NULL,
	"session_date" text NOT NULL,
	"bars" jsonb NOT NULL,
	"bar_count" integer NOT NULL,
	"source" text NOT NULL,
	"raw_sha256" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_minute_bars_symbol_session_date_pk" PRIMARY KEY("symbol","session_date")
);
