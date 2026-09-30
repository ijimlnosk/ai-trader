CREATE TABLE "external_api_usage" (
	"provider" text NOT NULL,
	"period" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_api_usage_provider_period_pk" PRIMARY KEY("provider","period"),
	CONSTRAINT "external_api_usage_used" CHECK ("external_api_usage"."used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"provider" text NOT NULL,
	"query" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"link" text NOT NULL,
	"original_link" text,
	"published_at" timestamp with time zone NOT NULL,
	"collected_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_symbol_link_idx" ON "news_items" USING btree ("symbol","link");--> statement-breakpoint
CREATE INDEX "news_items_published_idx" ON "news_items" USING btree ("published_at");