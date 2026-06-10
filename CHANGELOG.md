# Changelog

All notable changes to this project will be documented in this file.

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
