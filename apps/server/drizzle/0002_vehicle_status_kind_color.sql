CREATE TYPE "public"."vehicle_status_kind" AS ENUM('in_work', 'final', 'other');--> statement-breakpoint
ALTER TABLE "vehicle_statuses" ADD COLUMN "kind" "vehicle_status_kind" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_statuses" ADD COLUMN "color" varchar(7) DEFAULT '#8c8c8c' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_statuses" ADD CONSTRAINT "vehicle_statuses_color_check" CHECK ("vehicle_statuses"."color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
UPDATE "vehicle_statuses" SET "kind" = 'final', "color" = '#52c41a' WHERE "name" = 'передано';--> statement-breakpoint
UPDATE "vehicle_statuses" SET "kind" = 'in_work', "color" = '#1677ff' WHERE "name" = 'знайдено';--> statement-breakpoint
UPDATE "vehicle_statuses" SET "kind" = 'in_work', "color" = '#faad14' WHERE "name" = 'куплено';--> statement-breakpoint
UPDATE "vehicle_statuses" SET "kind" = 'in_work', "color" = '#ff7a45' WHERE "name" = 'в ремонті';--> statement-breakpoint
UPDATE "vehicle_statuses" SET "kind" = 'in_work', "color" = '#13c2c2' WHERE "name" = 'готове';
