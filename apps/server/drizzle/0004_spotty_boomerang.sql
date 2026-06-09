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
ALTER TABLE "donations" ADD CONSTRAINT "donations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_organization_donor_fk" FOREIGN KEY ("organization_id","donor_id") REFERENCES "public"."organization_donors"("organization_id","donor_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_organization_id_idx" ON "donations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "donations_organization_date_idx" ON "donations" USING btree ("organization_id","donation_date");--> statement-breakpoint
CREATE INDEX "donations_organization_donor_vehicle_idx" ON "donations" USING btree ("organization_id","donor_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "donations_donor_organization_vehicle_idx" ON "donations" USING btree ("donor_id","organization_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "donations_organization_category_idx" ON "donations" USING btree ("organization_id","category_id");--> statement-breakpoint
CREATE INDEX "donations_organization_vehicle_idx" ON "donations" USING btree ("organization_id","vehicle_id");