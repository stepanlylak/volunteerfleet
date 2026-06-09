import { sql } from 'drizzle-orm';
import { pgView, text, uuid } from 'drizzle-orm/pg-core';

// Slim alert view: one row per active alert per vehicle (vehicle_id, type).
// UA messages live in VEHICLE_ALERT_CONFIG (packages/shared), not in the DB.
// Predicates follow epic section 5; statuses are matched with explicit IN (...)
// sets (not enum ordinal comparison), only active vehicles/documents count, all
// relations are organization-scoped, and cyclic transitions check the FK on the
// latest relevant transition (so an old act cannot close a new transfer's alert).
export const vehicleAlertsView = pgView('vehicle_alerts_view', {
  vehicleId: uuid('vehicle_id'),
  type: text('type'),
}).as(
  sql`
    SELECT v.id AS vehicle_id, 'missing_registration_doc'::text AS type
    FROM vehicles v
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
    SELECT v.id, 'missing_customs_declaration'
    FROM vehicles v
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
    SELECT v.id, 'missing_stamped_customs_declaration'
    FROM vehicles v
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
    SELECT v.id, 'missing_transfer_act_draft'
    FROM vehicles v
    WHERE v.deleted_at IS NULL
      AND v.status IN ('ready', 'transferred')
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
    SELECT v.id, 'missing_transfer_act_signed'
    FROM vehicles v
    WHERE v.deleted_at IS NULL
      AND v.status = 'transferred'
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
          AND h.changed_at = (
            SELECT max(h2.changed_at)
            FROM vehicle_status_history h2
            WHERE h2.vehicle_id = v.id
              AND h2.organization_id = v.organization_id
              AND h2.new_status = 'transferred'
          )
      )

    UNION ALL
    SELECT v.id, 'not_registered_at_service_center'
    FROM vehicles v
    WHERE v.deleted_at IS NULL
      AND v.status = 'transferred'
      AND EXISTS (
        SELECT 1
        FROM vehicle_status_history h
        WHERE h.vehicle_id = v.id
          AND h.organization_id = v.organization_id
          AND h.new_status = 'transferred'
          AND h.is_registered_at_service_center IS NOT TRUE
          AND h.changed_at = (
            SELECT max(h2.changed_at)
            FROM vehicle_status_history h2
            WHERE h2.vehicle_id = v.id
              AND h2.organization_id = v.organization_id
              AND h2.new_status = 'transferred'
          )
      )

    UNION ALL
    SELECT v.id, 'missing_return_act'
    FROM vehicles v
    WHERE v.deleted_at IS NULL
      AND v.status = 'returned'
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
          AND h.changed_at = (
            SELECT max(h2.changed_at)
            FROM vehicle_status_history h2
            WHERE h2.vehicle_id = v.id
              AND h2.organization_id = v.organization_id
              AND h2.new_status = 'returned'
          )
      )
  `,
);
