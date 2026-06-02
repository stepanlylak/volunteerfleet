CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."currency_code" AS ENUM('UAH', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('upload', 'link');--> statement-breakpoint
CREATE TYPE "public"."funding_source_type" AS ENUM('donor', 'fundraiser', 'initiative', 'other');--> statement-breakpoint
CREATE TYPE "public"."rate_source" AS ENUM('default', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'volunteer', 'guest');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "funding_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "funding_source_type" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funding_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vehicle_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_statuses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"brand" varchar(128) NOT NULL,
	"model" varchar(128) NOT NULL,
	"year" smallint,
	"vin" varchar(64),
	"status_id" uuid NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"public_slug" varchar(96),
	"public_summary" text,
	"public_collected_amount_uah" numeric(14, 2),
	"public_goal_amount_uah" numeric(14, 2),
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vehicle_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"old_status_id" uuid,
	"new_status_id" uuid NOT NULL,
	"changed_by" uuid NOT NULL,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid,
	"expense_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency_code" NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"rate_source" "rate_source" NOT NULL,
	"category_id" uuid NOT NULL,
	"funding_source_id" uuid NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0),
	CONSTRAINT "expenses_rate_positive" CHECK ("expenses"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"kind" "document_kind" NOT NULL,
	"file_key" varchar(512),
	"url" varchar(2048),
	"mime_type" varchar(128),
	"size_bytes" bigint,
	"vehicle_id" uuid,
	"expense_id" uuid,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "documents_kind_payload" CHECK (("documents"."kind" = 'upload' AND "documents"."file_key" IS NOT NULL AND "documents"."url" IS NULL) OR ("documents"."kind" = 'link' AND "documents"."url" IS NOT NULL AND "documents"."file_key" IS NULL)),
	CONSTRAINT "documents_attached_to_something" CHECK ("documents"."vehicle_id" IS NOT NULL OR "documents"."expense_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_status_id_vehicle_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."vehicle_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_old_status_id_vehicle_statuses_id_fk" FOREIGN KEY ("old_status_id") REFERENCES "public"."vehicle_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_new_status_id_vehicle_statuses_id_fk" FOREIGN KEY ("new_status_id") REFERENCES "public"."vehicle_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_funding_source_id_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."funding_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_statuses_only_one_default" ON "vehicle_statuses" USING btree ("is_default") WHERE "vehicle_statuses"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_identifier_active_unique" ON "vehicles" USING btree ("identifier") WHERE "vehicles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_public_slug_active_unique" ON "vehicles" USING btree ("public_slug") WHERE "vehicles"."public_slug" IS NOT NULL AND "vehicles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "vehicles_status_id_idx" ON "vehicles" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "vehicles_brand_model_idx" ON "vehicles" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX "vehicles_vin_lower_idx" ON "vehicles" USING btree (lower("vin"));--> statement-breakpoint
CREATE INDEX "vehicles_is_public_idx" ON "vehicles" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "vehicle_status_history_vehicle_changed_at_idx" ON "vehicle_status_history" USING btree ("vehicle_id","changed_at");--> statement-breakpoint
CREATE INDEX "expenses_vehicle_id_idx" ON "expenses" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "expenses_expense_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_funding_source_id_idx" ON "expenses" USING btree ("funding_source_id");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "documents_vehicle_id_idx" ON "documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "documents_expense_id_idx" ON "documents" USING btree ("expense_id");