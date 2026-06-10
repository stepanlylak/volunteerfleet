CREATE TYPE "public"."currency_code" AS ENUM('UAH', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('upload', 'link');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('registration_certificate', 'customs_declaration', 'stamped_customs_declaration', 'transfer_act_draft', 'transfer_act_signed', 'return_act', 'other');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('coordinator', 'volunteer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."rate_source" AS ENUM('default', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superuser', 'user');--> statement-breakpoint
CREATE TYPE "public"."vehicle_gallery_item_type" AS ENUM('image');--> statement-breakpoint
CREATE TYPE "public"."vehicle_gallery_kind" AS ENUM('main', 'custom');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('new', 'paid', 'in_transit', 'arrived', 'in_repair', 'ready', 'transferred', 'returned', 'lost');--> statement-breakpoint
CREATE TABLE "users" (
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
CREATE TABLE "organizations" (
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
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_donors" (
	"organization_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"added_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_donors_pkey" PRIMARY KEY("organization_id","donor_id")
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"category_id" uuid,
	"donation_date" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency_code" NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"rate_source" "rate_source" NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "donations_amount_minor_positive" CHECK ("donations"."amount_minor" > 0),
	CONSTRAINT "donations_rate_positive" CHECK ("donations"."rate" > 0),
	CONSTRAINT "donations_rate_one_for_uah" CHECK ("donations"."currency" != 'UAH' OR "donations"."rate" = 1)
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
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
	"public_collected_amount_uah_minor" bigint,
	"public_goal_amount_uah_minor" bigint,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "vehicle_galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "vehicle_gallery_kind" NOT NULL,
	"name" varchar(255),
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"cover_item_id" uuid,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "vehicle_galleries_main_shape_check" CHECK ("vehicle_galleries"."kind" <> 'main' OR ("vehicle_galleries"."name" IS NULL AND "vehicle_galleries"."is_public" = true AND "vehicle_galleries"."sort_order" = 0)),
	CONSTRAINT "vehicle_galleries_custom_shape_check" CHECK ("vehicle_galleries"."kind" <> 'custom' OR ("vehicle_galleries"."name" IS NOT NULL AND length(trim("vehicle_galleries"."name")) > 0))
);
--> statement-breakpoint
CREATE TABLE "vehicle_gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"gallery_id" uuid NOT NULL,
	"type" "vehicle_gallery_item_type" NOT NULL,
	"file_key" varchar(512) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
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
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"old_status" "vehicle_status",
	"new_status" "vehicle_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transition_date" date DEFAULT now() NOT NULL,
	"is_local_purchase" boolean,
	"is_registered_at_service_center" boolean,
	"lost_reason" text,
	"registration_doc_id" uuid,
	"stamped_registration_doc_id" uuid,
	"customs_declaration_doc_id" uuid,
	"stamped_customs_declaration_doc_id" uuid,
	"transfer_act_draft_doc_id" uuid,
	"transfer_act_signed_doc_id" uuid,
	"return_act_doc_id" uuid
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"expense_date" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" "currency_code" NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"rate_source" "rate_source" NOT NULL,
	"category_id" uuid NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "expenses_amount_minor_positive" CHECK ("expenses"."amount_minor" > 0),
	CONSTRAINT "expenses_rate_positive" CHECK ("expenses"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
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
ALTER TABLE "users" ADD CONSTRAINT "users_last_active_org_id_organizations_id_fk" FOREIGN KEY ("last_active_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donors" ADD CONSTRAINT "donors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_organization_donor_fk" FOREIGN KEY ("organization_id","donor_id") REFERENCES "public"."organization_donors"("organization_id","donor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_galleries" ADD CONSTRAINT "vehicle_galleries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_galleries" ADD CONSTRAINT "vehicle_galleries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_galleries" ADD CONSTRAINT "vehicle_galleries_cover_item_id_vehicle_gallery_items_id_fk" FOREIGN KEY ("cover_item_id") REFERENCES "public"."vehicle_gallery_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_galleries" ADD CONSTRAINT "vehicle_galleries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_galleries" ADD CONSTRAINT "vehicle_galleries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_galleries" ADD CONSTRAINT "vehicle_galleries_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gallery_items" ADD CONSTRAINT "vehicle_gallery_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gallery_items" ADD CONSTRAINT "vehicle_gallery_items_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gallery_items" ADD CONSTRAINT "vehicle_gallery_items_gallery_id_vehicle_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."vehicle_galleries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gallery_items" ADD CONSTRAINT "vehicle_gallery_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gallery_items" ADD CONSTRAINT "vehicle_gallery_items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_gallery_items" ADD CONSTRAINT "vehicle_gallery_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_registration_doc_id_documents_id_fk" FOREIGN KEY ("registration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_stamped_registration_doc_id_documents_id_fk" FOREIGN KEY ("stamped_registration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_customs_declaration_doc_id_documents_id_fk" FOREIGN KEY ("customs_declaration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_stamped_customs_declaration_doc_id_documents_id_fk" FOREIGN KEY ("stamped_customs_declaration_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_transfer_act_draft_doc_id_documents_id_fk" FOREIGN KEY ("transfer_act_draft_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_transfer_act_signed_doc_id_documents_id_fk" FOREIGN KEY ("transfer_act_signed_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" ADD CONSTRAINT "vehicle_status_history_return_act_doc_id_documents_id_fk" FOREIGN KEY ("return_act_doc_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_name_active_unique" ON "organizations" USING btree ("name") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "donors_normalized_name_idx" ON "donors" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "organization_donors_organization_active_idx" ON "organization_donors" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "organization_donors_donor_id_idx" ON "organization_donors" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "donations_organization_id_idx" ON "donations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "donations_organization_date_idx" ON "donations" USING btree ("organization_id","donation_date");--> statement-breakpoint
CREATE INDEX "donations_organization_donor_vehicle_idx" ON "donations" USING btree ("organization_id","donor_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "donations_donor_organization_vehicle_idx" ON "donations" USING btree ("donor_id","organization_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "donations_organization_category_idx" ON "donations" USING btree ("organization_id","category_id");--> statement-breakpoint
CREATE INDEX "donations_organization_vehicle_idx" ON "donations" USING btree ("organization_id","vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_identifier_active_unique" ON "vehicles" USING btree ("identifier") WHERE "vehicles"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicles_brand_model_idx" ON "vehicles" USING btree ("brand","model");--> statement-breakpoint
CREATE INDEX "vehicles_vin_lower_idx" ON "vehicles" USING btree (lower("vin"));--> statement-breakpoint
CREATE INDEX "vehicles_is_public_idx" ON "vehicles" USING btree ("is_public");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_galleries_main_active_unique" ON "vehicle_galleries" USING btree ("vehicle_id") WHERE "vehicle_galleries"."kind" = 'main' AND "vehicle_galleries"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_galleries_name_active_unique" ON "vehicle_galleries" USING btree ("vehicle_id",lower(trim("name"))) WHERE "vehicle_galleries"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "vehicle_galleries_org_vehicle_idx" ON "vehicle_galleries" USING btree ("organization_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_galleries_vehicle_order_idx" ON "vehicle_galleries" USING btree ("vehicle_id","sort_order");--> statement-breakpoint
CREATE INDEX "vehicle_gallery_items_org_vehicle_gallery_idx" ON "vehicle_gallery_items" USING btree ("organization_id","vehicle_id","gallery_id");--> statement-breakpoint
CREATE INDEX "vehicle_gallery_items_gallery_order_idx" ON "vehicle_gallery_items" USING btree ("gallery_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_gallery_items_gallery_order_active_unique" ON "vehicle_gallery_items" USING btree ("gallery_id","sort_order") WHERE "vehicle_gallery_items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "vehicle_status_history_organization_id_idx" ON "vehicle_status_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vehicle_status_history_vehicle_changed_at_idx" ON "vehicle_status_history" USING btree ("vehicle_id","changed_at");--> statement-breakpoint
CREATE INDEX "vehicle_status_history_transition_date_idx" ON "vehicle_status_history" USING btree ("transition_date");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_status_history_unique_paid_per_vehicle" ON "vehicle_status_history" USING btree ("vehicle_id") WHERE "vehicle_status_history"."new_status" = 'paid';--> statement-breakpoint
CREATE INDEX "expenses_organization_id_idx" ON "expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "expenses_vehicle_id_idx" ON "expenses" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "expenses_expense_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "documents_organization_id_idx" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "documents_vehicle_id_idx" ON "documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "documents_expense_id_idx" ON "documents" USING btree ("expense_id");--> statement-breakpoint
CREATE VIEW "public"."vehicle_alerts_view" AS (
    SELECT v.id AS vehicle_id, 'missing_registration_doc'::text AS type, h_target.id AS vehicle_status_history_id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'paid'
    WHERE v.deleted_at IS NULL
      AND v.status IN ('paid', 'in_transit', 'arrived', 'in_repair', 'ready', 'transferred', 'returned')
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        JOIN documents d
          ON d.id = h.registration_doc_id
         AND d.deleted_at IS NULL
         AND d.organization_id = v.organization_id
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
      )

    UNION ALL
    SELECT v.id AS vehicle_id, 'missing_stamped_registration_doc'::text AS type, h_target.id AS vehicle_status_history_id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'arrived'
    WHERE v.deleted_at IS NULL
      AND v.status IN ('arrived', 'in_repair', 'ready', 'transferred', 'returned')
      AND EXISTS (
        SELECT 1
        FROM vehicle_status_history p
        WHERE p.vehicle_id = v.id
          AND p.organization_id = v.organization_id
          AND p.new_status = 'paid'
          AND p.is_local_purchase = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        JOIN documents d
          ON d.id = h.stamped_registration_doc_id
         AND d.deleted_at IS NULL
         AND d.organization_id = v.organization_id
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
      )

    UNION ALL
    SELECT v.id, 'missing_customs_declaration', h_target.id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'in_transit'
    WHERE v.deleted_at IS NULL
      AND v.status IN ('in_transit', 'arrived', 'in_repair', 'ready', 'transferred', 'returned')
      AND EXISTS (
        SELECT 1
        FROM vehicle_status_history p
        WHERE p.vehicle_id = v.id
          AND p.organization_id = v.organization_id
          AND p.new_status = 'paid'
          AND p.is_local_purchase = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        JOIN documents d
          ON d.id = h.customs_declaration_doc_id
         AND d.deleted_at IS NULL
         AND d.organization_id = v.organization_id
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
      )

    UNION ALL
    SELECT v.id, 'missing_stamped_customs_declaration', h_target.id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'arrived'
    WHERE v.deleted_at IS NULL
      AND v.status IN ('arrived', 'in_repair', 'ready', 'transferred', 'returned')
      AND EXISTS (
        SELECT 1
        FROM vehicle_status_history p
        WHERE p.vehicle_id = v.id
          AND p.organization_id = v.organization_id
          AND p.new_status = 'paid'
          AND p.is_local_purchase = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        JOIN documents d
          ON d.id = h.stamped_customs_declaration_doc_id
         AND d.deleted_at IS NULL
         AND d.organization_id = v.organization_id
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
      )

    UNION ALL
    SELECT v.id, 'missing_transfer_act_draft', h_target.id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'ready'
    WHERE v.deleted_at IS NULL
      AND v.status IN ('ready', 'transferred')
      AND h_target.changed_at = (
        SELECT max(h2.changed_at)
        FROM vehicle_status_history h2
        WHERE h2.vehicle_id = v.id
          AND h2.organization_id = v.organization_id
          AND h2.new_status = 'ready'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        JOIN documents d
          ON d.id = h.transfer_act_draft_doc_id
         AND d.deleted_at IS NULL
         AND d.organization_id = v.organization_id
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
      )

    UNION ALL
    SELECT v.id, 'missing_transfer_act_signed', h_target.id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'transferred'
    WHERE v.deleted_at IS NULL
      AND v.status = 'transferred'
      AND h_target.changed_at = (
        SELECT max(h2.changed_at)
        FROM vehicle_status_history h2
        WHERE h2.vehicle_id = v.id
          AND h2.organization_id = v.organization_id
          AND h2.new_status = 'transferred'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        JOIN documents d
          ON d.id = h.transfer_act_signed_doc_id
         AND d.deleted_at IS NULL
         AND d.organization_id = v.organization_id
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
          AND h.new_status = 'transferred'
          AND h.changed_at = h_target.changed_at
      )

    UNION ALL
    SELECT v.id, 'not_registered_at_service_center', h_target.id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'transferred'
    WHERE v.deleted_at IS NULL
      AND v.status = 'transferred'
      AND h_target.changed_at = (
        SELECT max(h2.changed_at)
        FROM vehicle_status_history h2
        WHERE h2.vehicle_id = v.id
          AND h2.organization_id = v.organization_id
          AND h2.new_status = 'transferred'
      )
      AND h_target.is_registered_at_service_center IS NOT TRUE

    UNION ALL
    SELECT v.id, 'missing_return_act', h_target.id
    FROM vehicles v
    JOIN vehicle_status_history h_target
      ON h_target.vehicle_id = v.id
     AND h_target.organization_id = v.organization_id
     AND h_target.new_status = 'returned'
    WHERE v.deleted_at IS NULL
      AND v.status = 'returned'
      AND h_target.changed_at = (
        SELECT max(h2.changed_at)
        FROM vehicle_status_history h2
        WHERE h2.vehicle_id = v.id
          AND h2.organization_id = v.organization_id
          AND h2.new_status = 'returned'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        JOIN documents d
          ON d.id = h.return_act_doc_id
         AND d.deleted_at IS NULL
         AND d.organization_id = v.organization_id
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
          AND h.new_status = 'returned'
          AND h.changed_at = h_target.changed_at
      )
  );