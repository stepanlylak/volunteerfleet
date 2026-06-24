# Changelog

All notable changes to this project will be documented in this file.

## [3.1.0] - 2026-06-25

### Highlights

- Added a unified document preview modal with row-click opening, image lightbox support, and embedded PDF
  viewing.
- Redesigned the vehicle status history timeline and refined status transitions.
- Unified the vehicle status flow across local and non-local purchase scenarios, with document group labels
  now coming from a single source of truth.
- Moved `borderCrossingDate` into vehicle status history so border crossing data follows the status workflow.

### Fixes

- Fixed CSP, Google Fonts loading, PDF iframe rendering, and expense document cache invalidation.
- Fixed financial entry invalidation after expense document synchronization.
- Prevented document detachment while editing vehicles and corrected the local-purchase flag source.

## [3.0.0] - 2026-06-16

### Highlights

- Added document groups: bundle multiple files and links into a single logical document, available across
  expenses, donations, standalone documents, and vehicle status history.
- Unified the database migrations into a single consolidated baseline, folding the vehicle alerts view into
  the initial migration.
- Reworked deployment into parameterized, environment-aware `prod` and `stg` stacks with `STACK`-namespaced
  container naming and env-aware `deploy/backup.sh` and `deploy/update.sh`.
- Refreshed the exchange rates dataset with revised historical data and projections through 2026.

### Breaking Changes

- Rewrote the PostgreSQL migration baseline: the previous `0000_init` and `0001_vehicle_alerts_view`
  migrations are replaced by a single unified migration. Existing databases must be reset and re-migrated
  against the new baseline.
- Restructured deployment files: removed the root `backup.sh`, `update.sh`, `docker-compose.prod.yml`, and
  `.env.prod.example` in favor of `deploy/{prod,stg}/compose.yml`, `deploy/{prod,stg}/.env.example`, and
  `deploy/{backup,update}.sh`. Container and network naming now derives from the `STACK` parameter.

## [2.0.0] - 2026-06-10

### Highlights

- Added organization multi-tenancy with organization-scoped data, membership roles, active organization
  switching, and platform administration APIs.
- Added the complete vehicle status workflow with controlled transitions, editable history, computed alerts,
  and status-aware UI.
- Rebuilt financial tracking around donors, donations, expenses, and a unified financial journal using
  minor currency units.
- Added vehicle galleries with uploads, captions, ordering, covers, moves, soft deletion, and public
  gallery views.
- Redesigned the application UI and migrated global styling to SCSS.

### Breaking Changes

- Reset the PostgreSQL migration baseline for the expanded organization, finance, status, and gallery
  schemas.
- Removed the legacy vehicle photos flow in favor of vehicle galleries.
- Removed funding sources and the legacy funding reports from the financial model.
- Changed authentication to cookie-only access with active organization context in JWTs.
- Scoped public and authenticated vehicle data by organization.

### Fixes

- Fixed vehicle reads after status transitions commit.
- Fixed organization membership names and TypeScript errors found during the multi-tenancy review.
- Reworked the migration baseline so clean installations and migrated databases use the same schema.

## [1.1.0] - 2026-06-02

### Fixes

- `ad5cb39` fix: send access cookie as SameSite=Lax for native file loads
- `e6d15e4` fix: decode multipart filenames as UTF-8 for object keys

### Chores / Security

- `279aca6` chore(security): enable and configure CSP

### Docs

- `069e13d` docs: align release workflow with trunk-based release-snapshot model
