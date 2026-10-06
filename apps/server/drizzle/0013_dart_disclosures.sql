CREATE TABLE "dart_disclosures" (
	"receipt_no" text PRIMARY KEY NOT NULL,
	"corp_code" text NOT NULL,
	"corp_name" text NOT NULL,
	"stock_code" text NOT NULL,
	"corp_class" text NOT NULL,
	"report_name" text NOT NULL,
	"filer_name" text NOT NULL,
	"receipt_date" text NOT NULL,
	"remarks" text NOT NULL,
	"provider" text NOT NULL,
	"collected_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dart_disclosures_stock_date_idx" ON "dart_disclosures" USING btree ("stock_code","receipt_date");