# Security hardening — 2026-08-30

This change set closes the remaining privacy, lifecycle, public-list, App Check and deployment-auth gaps found during the repository-wide audit.

## Code-side changes

- Public visitors can no longer receive `cases/{caseId}.caseDescription` through `getPublicCaseOriginal`. The real submission text is owner-only; public visitors receive only the dedicated sanitized public summary or a fixed privacy notice.
- Explicit Korean real-name patterns are added to the content safety layer, and deploy-time public-result sanitation clears unsafe public summaries.
- Discussion comments re-check the latest result state inside the same Firestore transaction that writes the comment. Deleted or hidden results cannot be recreated by a stale `set(..., { merge: true })` write.
- Browser clients no longer list the internal `results` collection. `listPublicResults` reads with Admin SDK, verifies the sanitized public schema, and returns an explicit allow-list projection only.
- Firestore `results` list access is administrator-only. Public single-document reads remain guarded by the sanitized schema.
- The public list callable requires a Firebase Auth session, supports App Check enforcement, and has a per-session action limit.
- GitHub Actions are pinned to immutable SHAs where applicable.
- Firebase deployment authentication prefers GitHub OIDC + Google Workload Identity Federation. The existing service-account JSON remains only as a temporary fallback so current production deployment is not broken during migration.
- App Check's browser key is injected only at deployment time from a GitHub Actions variable, so the repository does not need an environment-specific key committed into source.

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

- Firestore emulator confirms public clients cannot list `results` directly while administrators retain dashboard access.
- Public-boundary tests verify raw originals stay owner-only, the public list projection drops sensitive/internal fields, explicit real-name patterns are rejected, and discussion writes fail closed during deletion.
- Static hardening checks verify the new public-list callable, transaction guard, App Check injection, WIF-ready authentication and deployment ordering remain in place.
