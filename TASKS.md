# Deferred Tasks

Items below remain intentionally deferred after the current fixing session. These are either infrastructure-coupled, repository-history operations, migration-sensitive changes, or larger feature projects.

## External / Infra

1. Git history cleanup
   - Remove archived secret files from git history:
     - `legacy/web/.env.local`
     - `legacy/mobile/google-services.json`
   - Use a proper history rewrite workflow (`git filter-repo` or equivalent), then force-push with care.

2. Profile picture storage migration
   - Move profile pictures out of database base64 storage.
   - Target object storage such as S3 or Cloudinary.
   - Add upload signing, retention policy, and URL cleanup on replacement/deletion.

3. Email notification system
   - Choose provider.
   - Add templates, delivery service, unsubscribe/preferences behavior, and failure logging.

## Migration-Sensitive

4. `AttendanceLog.date` migration
   - Convert from `String` to `DateTime`.
   - Requires Prisma schema migration, data backfill, and route/query updates.

5. Restore unique constraints
   - Reintroduce safe uniqueness for:
     - `SemesterResult`
     - `Timetable`
   - Requires deduplication strategy before schema enforcement.

## Product / Feature Work

6. Stronger offline mode
   - Extend beyond current PWA caching.
   - Define offline write queue / sync strategy if mutations should work offline.

7. Accessibility pass
   - Run a WCAG-focused audit.
   - Improve keyboard navigation, focus states, semantics, and contrast where needed.

8. Automated tests
   - Add real unit/integration coverage beyond current build validation and smoke tooling.

10. Multi-language support
   - Add i18n framework, message extraction, locale routing/storage, and translation files.

11. Teacher/admin dashboard
   - Separate roles, auth model, permissions, and dedicated UI/API surface. (Not Required for MVP but a common future expansion.)

12. Grade prediction AI feature
   - Define feature scope, model inputs, evaluation criteria, and UX constraints.

13. Collaborative features
   - Shared schedules, invites, access control, and conflict resolution model.

## Optional Maintainability Follow-ups

14. Further `ipu.ts` decomposition
   - Session/state extraction is already done.
   - Remaining parsing/scraping helpers can still be split further for maintainability.

15. Bundle-size reduction pass
   - Main frontend build still has large chunks.
   - Next targets:
     - result PDF generation bundle
     - main app chunk
     - additional lazy-loading boundaries

## Notes

- These items are deferred, not forgotten.
- `DOCUMENTATION.md` has already been reconciled against the current repository state.
- This file is the forward-looking queue for the larger remaining work.
