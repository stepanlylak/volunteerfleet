ALTER TABLE "expense_categories" RENAME TO "financial_categories";--> statement-breakpoint
ALTER TABLE "financial_categories" DROP CONSTRAINT "expense_categories_name_unique";--> statement-breakpoint
ALTER TABLE "vehicle_status_history" DROP CONSTRAINT "vehicle_status_history_purchase_currency_group";--> statement-breakpoint
ALTER TABLE "vehicle_status_history" DROP CONSTRAINT "vehicle_status_history_purchase_rate_one_for_uah";--> statement-breakpoint
ALTER TABLE "donations" DROP CONSTRAINT "donations_category_id_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_category_id_expense_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_funding_source_id_funding_sources_id_fk";
--> statement-breakpoint
DROP INDEX "expenses_funding_source_id_idx";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "vehicle_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_financial_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."financial_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_status_history" DROP COLUMN "purchase_price";--> statement-breakpoint
ALTER TABLE "vehicle_status_history" DROP COLUMN "purchase_currency";--> statement-breakpoint
ALTER TABLE "vehicle_status_history" DROP COLUMN "purchase_rate";--> statement-breakpoint
ALTER TABLE "vehicle_status_history" DROP COLUMN "purchase_rate_source";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "funding_source_id";--> statement-breakpoint
DROP TABLE "funding_sources";--> statement-breakpoint
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_name_unique" UNIQUE("name");--> statement-breakpoint
DROP TYPE "public"."funding_source_type";
