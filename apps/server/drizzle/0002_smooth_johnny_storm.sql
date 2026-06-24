ALTER TABLE "vehicle_status_history" ADD COLUMN "border_crossing_date" date;--> statement-breakpoint
UPDATE "vehicle_status_history" AS h
SET "border_crossing_date" = v."border_crossing_date"
FROM "vehicles" AS v
WHERE h."vehicle_id" = v."id"
  AND v."border_crossing_date" IS NOT NULL
  AND h."new_status" = 'arrived'
  AND h."id" = (
    SELECT h2."id"
    FROM "vehicle_status_history" AS h2
    WHERE h2."vehicle_id" = v."id"
      AND h2."new_status" = 'arrived'
    ORDER BY h2."changed_at" ASC
    LIMIT 1
  );--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN "border_crossing_date";
