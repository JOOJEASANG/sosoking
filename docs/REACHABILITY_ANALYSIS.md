# Reachability analysis

Static import/reference traversal from deployed HTML files, the service worker, web manifest, and the Functions package entrypoint.

- Roots: **5**
- Reachable code/assets: **49**
- Unreachable JS/CSS/HTML candidates: **6**
- Missing local references: **1**

## Roots

- `functions/main.js`
- `public/admin/index.html`
- `public/index.html`
- `public/site.webmanifest`
- `public/sw.js`

## Unreachable candidates

- `public/admin/admin-email-guard.js`
- `public/css/theme-toggle.css`
- `public/js/components/app-install.js`
- `public/js/components/theme-contrast.js`
- `public/js/pages/auth.js`
- `public/js/pwa-init.js`

## Likely superseded files

- `public/js/pages/auth.js` → `public/js/pages/auth2.js`

## Missing local references

- `public/sw.js` → `/admin`
