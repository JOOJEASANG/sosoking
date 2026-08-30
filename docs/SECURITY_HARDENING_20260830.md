# Security hardening — 2026-08-30

This change set closes the privacy, lifecycle, public-data, App Check and deployment-auth gaps found during the repository-wide audit.

## Code-side changes

- Public visitors can no longer receive `cases/{caseId}.caseDescription` through `getPublicCaseOriginal`. The real submission text is owner-only; public visitors receive only the dedicated sanitized public summary or a fixed privacy notice.
- Explicit Korean real-name patterns are added to the content safety layer, including honorifics followed by Korean particles, and deploy-time public-result sanitation clears unsafe public summaries.
- Discussion comments re-check the latest result state inside the same Firestore transaction that writes the comment. Deleted or hidden results cannot be recreated by a stale `set(..., { merge: true })` write.
- Internal `results/{caseId}` documents are owner/admin-only in Firestore rules, even when a result is public.
- Public home/board lists use the `listPublicResults` callable. Public verdict details and discussions use `getPublicResult`. Neither public path reads internal `results` directly from the browser.
- Both public callables re-check the authoritative internal `results` publication state with Admin SDK and return only an explicit allow-list projection. A hidden, private, malformed or deleted result fails closed.
- `public_results` is a separate sanitized server/admin-only mirror. It is backfilled during deployment and refreshed by public server calls, but it is never trusted as the authority for current visibility and is never read directly by normal browser clients.
- The design intentionally avoids a Firestore Eventarc mirror trigger, so deployment does not acquire a new Eventarc/IAM dependency. Current publication state is always checked synchronously before serving public data.
- Public reactions/comments remain readable only to signed-in Firebase sessions when the authoritative result is still a safe public result. A stale mirror cannot keep participation data visible after moderation or privacy changes.
- Public callables require a Firebase Auth session, support App Check enforcement, and have server-side action limits.
- GitHub Actions are pinned to immutable SHAs where applicable.
- Firebase deployment authentication prefers GitHub OIDC + Google Workload Identity Federation. The existing service-account JSON remains only as a temporary fallback so current production deployment is not broken during migration.
- App Check's browser key is injected only at deployment time from a GitHub Actions variable, so the repository does not need an environment-specific key committed into source.

## Deployment order

The normal Firebase workflow now preserves this order:

1. Validate the repository and Firestore emulator tests.
2. Deploy current callable/scheduled/HTTP Functions.
3. Sanitize existing public internal results.
4. Backfill and clean the isolated `public_results` mirror with `functions/sync-public-results-cli.js`.
5. Run existing data-format migrations.
6. Deploy Firestore indexes and rules.
7. Initialize public statistics and safe public configuration.
8. Deploy Hosting.

The mirror backfill is operational hygiene only; public visibility is still decided from the authoritative internal result at request time.

## One-time external activation

The repository is ready for these settings, but they must be created in Firebase / Google Cloud / GitHub because their values are environment-specific.

### 1. Enable Firebase App Check

1. Register the production Firebase web app with App Check using reCAPTCHA v3.
2. Add the site key as the GitHub repository variable `APP_CHECK_SITE_KEY`.
3. Set GitHub repository variable `ENFORCE_APP_CHECK` to `true`.
4. Run the normal Firebase deployment and verify login, home feed, public verdict pages, voting, comments and admin access.

The deployment intentionally fails if `ENFORCE_APP_CHECK=true` but `APP_CHECK_SITE_KEY` is missing.

### 2. Switch Firebase deployment to keyless WIF

1. Create a Google Cloud Workload Identity Pool / Provider that trusts this GitHub repository.
2. Grant the deployment service account only the roles required by the existing Firebase deployment workflow.
3. Add the provider resource name as GitHub repository variable `GCP_WORKLOAD_IDENTITY_PROVIDER`.
4. Add the deploy service-account email as GitHub repository variable `GCP_DEPLOY_SERVICE_ACCOUNT`.
5. Run a deployment and confirm the `Authenticate to Google Cloud` step uses Workload Identity Federation.
6. After a successful WIF deployment, remove the legacy GitHub secret `FIREBASE_SERVICE_ACCOUNT_SOSOKING_481E6` and revoke/delete the old service-account key in Google Cloud.

Until both WIF variables exist, the workflow deliberately falls back to the current JSON secret so production deployment remains available.

## Regression coverage

- Firestore emulator verifies internal `results` are owner/admin-only, `public_results` is server/admin-only, and public comments/reactions re-check authoritative publication state.
- Public-boundary tests verify raw originals stay owner-only, public projections drop sensitive/internal fields, explicit real-name patterns are rejected, and discussion writes fail closed during deletion.
- Public-detail tests prevent public verdict/discussion pages from returning to direct internal `results` reads.
- Static hardening checks ensure no Eventarc mirror trigger is reintroduced, public callables always verify authoritative state, App Check injection and WIF-ready authentication stay configured, and deployment ordering remains safe.
