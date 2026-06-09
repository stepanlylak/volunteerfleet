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
ALTER TABLE "donors" ADD CONSTRAINT "donors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_donors" ADD CONSTRAINT "organization_donors_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donors_normalized_name_idx" ON "donors" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "organization_donors_organization_active_idx" ON "organization_donors" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "organization_donors_donor_id_idx" ON "organization_donors" USING btree ("donor_id");