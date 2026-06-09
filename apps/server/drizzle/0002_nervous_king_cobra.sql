DROP VIEW "public"."vehicle_alerts_view";--> statement-breakpoint
ALTER TABLE "vehicles" RENAME COLUMN "public_collected_amount_uah" TO "public_collected_amount_uah_minor";--> statement-breakpoint
ALTER TABLE "vehicles" RENAME COLUMN "public_goal_amount_uah" TO "public_goal_amount_uah_minor";--> statement-breakpoint
ALTER TABLE "expenses" RENAME COLUMN "amount" TO "amount_minor";--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_amount_positive";--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "public_collected_amount_uah_minor" TYPE bigint USING round("public_collected_amount_uah_minor" * 100)::bigint;--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "public_goal_amount_uah_minor" TYPE bigint USING round("public_goal_amount_uah_minor" * 100)::bigint;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "amount_minor" TYPE bigint USING round("amount_minor" * 100)::bigint;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_minor_positive" CHECK ("expenses"."amount_minor" > 0);--> statement-breakpoint
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
