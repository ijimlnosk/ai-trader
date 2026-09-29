CREATE TABLE "trading_control_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_account" text NOT NULL,
	"user_id" uuid,
	"auto_trading_enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_controls" (
	"execution_account" text PRIMARY KEY NOT NULL,
	"auto_trading_enabled" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trading_control_events" ADD CONSTRAINT "trading_control_events_user_id_console_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."console_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_controls" ADD CONSTRAINT "trading_controls_updated_by_console_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."console_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trading_control_events_account_idx" ON "trading_control_events" USING btree ("execution_account","created_at");