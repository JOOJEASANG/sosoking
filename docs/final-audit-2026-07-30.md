# Final comprehensive audit — 2026-07-30

The restored pre-redesign runtime was audited through the complete repository validation chain and Firebase Firestore emulator integration tests.

## Corrected during the audit

- Updated the guide from the legacy one-case description to the current three daily cases and daily/weekly/all-time rankings.
- Updated displayed terms, including previously saved managed terms, to the current three-case participation rules.
- Changed the daily ranking query so completed users are filtered before the server query limit is applied.
- Added the completed/score Firestore composite index required by that ranking query.
- Added regression checks for the corrected guide, terms, ranking query, index, and active cache versions.

## Validation coverage

- routing, public pages, navigation, responsive spacing, themes, headers, and PWA assets
- Google/email authentication, verification, administrator routing, and account controls
- case submission, AI processing, verdict documents, publication, search, discussion, reports, and deletion
- daily real-court three-case flow, scores, streaks, and daily/weekly/all-time rankings
- Firestore permissions, legacy migration, public SEO, CSP, hosting headers, service-worker cache, and deployment wiring

## Operational follow-ups outside source-code validation

- The verified daily real-court catalog currently contains 10 cases; the code supports up to 500.
- Firebase App Check is prepared but not enforceable until a reCAPTCHA site key and deployment variable are configured.
- The scheduled public daily AI case remains enabled unless `site_settings/config.dailyAiEnabled` is set to `false`.
- The root and `www` custom domains currently serve different site versions and require Firebase Hosting/DNS mapping review.
