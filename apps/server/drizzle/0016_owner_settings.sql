CREATE TABLE "owner_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"execution_account" text NOT NULL,
	"settings" jsonb NOT NULL,
	"effective_from" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "owner_settings" ADD CONSTRAINT "owner_settings_created_by_console_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."console_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "owner_settings_account_idx" ON "owner_settings" USING btree ("execution_account","effective_from","created_at");