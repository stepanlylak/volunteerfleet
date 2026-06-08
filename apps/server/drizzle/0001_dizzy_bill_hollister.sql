-- Add column as nullable first
ALTER TABLE "funding_sources" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
-- Set default organization for existing rows (primary org from seed)
UPDATE "funding_sources" SET "organization_id" = '00000000-0000-4000-8000-000000000401' WHERE "organization_id" IS NULL;--> statement-breakpoint
-- Make column NOT NULL
ALTER TABLE "funding_sources" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
-- Add foreign key constraint
ALTER TABLE "funding_sources" ADD CONSTRAINT "funding_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;