DO $$ BEGIN
 CREATE TYPE "public"."currency_code" AS ENUM('UAH', 'USD', 'EUR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_kind" AS ENUM('upload', 'link');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_type" AS ENUM('registration_certificate', 'customs_declaration', 'stamped_customs_declaration', 'transfer_act_draft', 'transfer_act_signed', 'return_act', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."funding_source_type" AS ENUM('donor', 'fundraiser', 'initiative', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."org_role" AS ENUM('coordinator', 'volunteer', 'viewer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."rate_source" AS ENUM('default', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('superuser', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."vehicle_status" AS ENUM('new', 'paid', 'in_transit', 'arrived', 'in_repair', 'ready', 'transferred', 'returned', 'lost');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"last_active_org_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funding_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"type" "funding_source_type" NOT NULL,
	"description" text,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funding_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"identifier" varchar(64) NOT NULL,
	"brand" varchar(128) NOT NULL,
	"model" varchar(128) NOT NULL,
	"year" smallint,
	"vin" varchar(64),
	"border_crossing_date" date,
	"start_date" date NOT NULL,
	"status" "vehicle_status" DEFAULT 'new' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
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
CREATE TABLE IF NOT EXISTS "vehicle_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"file_key" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"old_status" "vehicle_status",
	"new_status" "vehicle_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transition_date" date DEFAULT now() NOT NULL,
	"purchase_price" numeric(14, 2),
	"purchase_currency" "currency_code",
	"purchase_rate" numeric(14, 6),
	"purchase_rate_source" "rate_source",
	"is_local_purchase" boolean,
	"is_registered_at_service_center" boolean,
	"lost_reason" text,
	"registration_doc_id" uuid,
	"stamped_registration_doc_id" uuid,
	"customs_declaration_doc_id" uuid,
	"stamped_customs_declaration_doc_id" uuid,
	"transfer_act_draft_doc_id" uuid,
	"transfer_act_signed_doc_id" uuid,
	"return_act_doc_id" uuid,
	CONSTRAINT "vehicle_status_history_purchase_currency_group" CHECK ((
        ("vehicle_status_history"."purchase_price" IS NULL AND "vehicle_status_history"."purchase_currency" IS NULL AND "vehicle_status_history"."purchase_rate" IS NULL AND "vehicle_status_history"."purchase_rate_source" IS NULL)
        OR
        ("vehicle_status_history"."purchase_price" IS NOT NULL AND "vehicle_status_history"."purchase_currency" IS NOT NULL AND "vehicle_status_history"."purchase_rate" IS NOT NULL AND "vehicle_status_history"."purchase_rate_source" IS NOT NULL)
      )),
	CONSTRAINT "vehicle_status_history_purchase_rate_one_for_uah" CHECK ((
        "vehicle_status_history"."purchase_currency" IS NULL
        OR
        "vehicle_status_history"."purchase_currency" != 'UAH'
        OR
        "vehicle_status_history"."purchase_rate" = 1
      ))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
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
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"kind" "document_kind" NOT NULL,
	"document_type" "document_type" DEFAULT 'other' NOT NULL,
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
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_last_active_org_id_organizations_id_fk" FOREIGN KEY ("last_active_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funding_sources" ADD CONSTRAINT "funding_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_registration_doc_id_documents_id_fk" FOREIGN KEY ("registration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vsh_stamped_registration_doc_id_documents_id_fk" FOREIGN KEY ("stamped_registration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_customs_declaration_doc_id_documents_id_fk" FOREIGN KEY ("customs_declaration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_stamped_customs_declaration_doc_id_documents_id_fk" FOREIGN KEY ("stamped_customs_declaration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_transfer_act_draft_doc_id_documents_id_fk" FOREIGN KEY ("transfer_act_draft_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_transfer_act_signed_doc_id_documents_id_fk" FOREIGN KEY ("transfer_act_signed_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_return_act_doc_id_documents_id_fk" FOREIGN KEY ("return_act_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_funding_source_id_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."funding_sources"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_active_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_name_active_unique" ON "organizations" USING btree ("name") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_members_organization_id_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_identifier_active_unique" ON "vehicles" USING btree ("identifier") WHERE "vehicles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_organization_id_idx" ON "vehicles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_status_idx" ON "vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_brand_model_idx" ON "vehicles" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_vin_lower_idx" ON "vehicles" USING btree (lower("vin"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_is_public_idx" ON "vehicles" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_photos_organization_id_idx" ON "vehicle_photos" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_photos_vehicle_id_idx" ON "vehicle_photos" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_photos_vehicle_order_idx" ON "vehicle_photos" USING btree ("vehicle_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_status_history_organization_id_idx" ON "vehicle_status_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_status_history_vehicle_changed_at_idx" ON "vehicle_status_history" USING btree ("vehicle_id","changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_status_history_transition_date_idx" ON "vehicle_status_history" USING btree ("transition_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_status_history_unique_paid_per_vehicle" ON "vehicle_status_history" USING btree ("vehicle_id") WHERE "vehicle_status_history"."new_status" = 'paid';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_organization_id_idx" ON "expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_vehicle_id_idx" ON "expenses" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_expense_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_funding_source_id_idx" ON "expenses" USING btree ("funding_source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_organization_id_idx" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_vehicle_id_idx" ON "documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_expense_id_idx" ON "documents" USING btree ("expense_id");