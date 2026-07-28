import fs from 'node:fs';

function write(file, source) {
  fs.writeFileSync(file, source);
}

{
  const file = 'tools/check-project.mjs';
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(
    "  'public/admin/admin-ai-tools.js',\n",
    "  'public/admin/admin-ai-tools.js',\n  'public/admin/admin-enhancements.js',\n  'public/admin/admin-security-overrides.js',\n"
  );
  source = source.replace(
    /\/\/ Regression checks for the full admin\/UI audit\.[\s\S]*?(?=const rules = read\('firestore\.rules'\);)/,
    `// Regression checks for the consolidated administrator UI.\nconst adminIndex = read('public/admin/index.html');\nif (!adminIndex.includes('/admin/admin-bootstrap.js?v=20260729-admin-consolidated-1')) {\n  errors.push('public/admin/index.html: consolidated admin bootstrap is not loaded');\n}\nif (adminIndex.includes('admin-enhancements.js') || adminIndex.includes('admin-security-overrides.js')) {\n  errors.push('public/admin/index.html: removed admin patch modules are referenced');\n}\n\nconst adminBootstrap = read('public/admin/admin-bootstrap.js');\nif (!adminBootstrap.includes("module.mountAdminDashboard(user)")) {\n  errors.push('public/admin/admin-bootstrap.js: authorized user is not passed to the dashboard module');\n}\nif (adminBootstrap.includes('admin-enhancements.js') || adminBootstrap.includes('admin-security-overrides.js')) {\n  errors.push('public/admin/admin-bootstrap.js: obsolete admin patch module import remains');\n}\nif (!adminBootstrap.includes('signInWithRedirect')) {\n  errors.push('public/admin/admin-bootstrap.js: mobile redirect login fallback is missing');\n}\n\nconst adminDashboard = read('public/admin/admin.js');\nif (!adminDashboard.includes('export function mountAdminDashboard(user)')) {\n  errors.push('public/admin/admin.js: explicit dashboard mount entry point is missing');\n}\nif (adminDashboard.includes('MutationObserver') || adminDashboard.includes('window._')) {\n  errors.push('public/admin/admin.js: global monkey patch or DOM observer remains');\n}\nfor (const callable of ['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile', 'generateDailyAiNow', 'syncPublicStatsNow']) {\n  if (!adminDashboard.includes(\`httpsCallable(functions, '\${callable}')\`)) {\n    errors.push(\`public/admin/admin.js: secure callable \${callable} is missing\`);\n  }\n}\n\n`
  );
  write(file, source);
}

{
  const file = 'tools/check-security-regressions.mjs';
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(
    `const adminActions = read('functions/admin-actions.js');\nfor (const item of ['court_comment_authors', 'report_keys', 'case_id_aliases']) {\n  if (!adminActions.includes(item)) {\n    errors.push(\`functions/admin-actions.js: cascade deletion omits \${item}\`);\n  }\n}\n`,
    `const adminActions = read('functions/admin-actions.js');\nfor (const item of ['court_comment_authors', 'report_keys', 'case_id_aliases']) {\n  if (!adminActions.includes(item)) {\n    errors.push(\`functions/admin-actions.js: cascade deletion omits \${item}\`);\n  }\n}\nif (!adminActions.includes('exports.deleteUserProfile')\n  || !adminActions.includes('nameSnap.data().uid === userId')\n  || !adminActions.includes('tx.delete(nameRef)')) {\n  errors.push('functions/admin-actions.js: transactional profile and nickname cleanup is missing');\n}\n`
  );
  source = source.replace(
    `const adminOverrides = read('public/admin/admin-security-overrides.js');\nif (!adminOverrides.includes("httpsCallable(functions, 'setAdminResultVisibility')")) {\n  errors.push('public/admin/admin-security-overrides.js: admin visibility still bypasses the server callable');\n}\n`,
    `const adminBootstrap = read('public/admin/admin-bootstrap.js');\nconst adminDashboard = read('public/admin/admin.js');\nif (!adminBootstrap.includes('module.mountAdminDashboard(user)')\n  || adminBootstrap.includes('admin-enhancements.js')\n  || adminBootstrap.includes('admin-security-overrides.js')) {\n  errors.push('public/admin/admin-bootstrap.js: administrator module boundary is not consolidated');\n}\nif (adminDashboard.includes('MutationObserver') || adminDashboard.includes('window._')\n  || adminDashboard.includes("updateDoc(doc(db, 'results'")\n  || adminDashboard.includes("deleteDoc(doc(db, 'cases'")) {\n  errors.push('public/admin/admin.js: legacy monkey patch or direct case mutation remains');\n}\nfor (const callable of ['setAdminResultVisibility', 'deleteCourtPost', 'deleteUserProfile']) {\n  if (!adminDashboard.includes(\`httpsCallable(functions, '\${callable}')\`)) {\n    errors.push(\`public/admin/admin.js: administrator callable \${callable} is missing\`);\n  }\n}\n`
  );
  source = source.replace(
    "  'migrateLegacyCaseIds'\n]) {",
    "  'migrateLegacyCaseIds',\n  'deleteUserProfile'\n]) {"
  );
  write(file, source);
}

{
  const file = 'tools/check-script-csp.mjs';
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(
    `const adminBootstrap = fs.readFileSync('public/admin/admin-bootstrap.js', 'utf8');\nfor (const moduleName of ['admin.js', 'admin-enhancements.js', 'admin-security-overrides.js']) {\n  if (!adminBootstrap.includes(\`./\${moduleName}?v=20260729-script-csp-1\`)) {\n    errors.push(\`public/admin/admin-bootstrap.js: stale \${moduleName} cache version remains\`);\n  }\n}\n`,
    `const adminIndex = fs.readFileSync('public/admin/index.html', 'utf8');\nif (!adminIndex.includes('/admin/admin-bootstrap.js?v=20260729-admin-consolidated-1')) {\n  errors.push('public/admin/index.html: consolidated administrator bootstrap version is missing');\n}\nconst adminBootstrap = fs.readFileSync('public/admin/admin-bootstrap.js', 'utf8');\nif (!adminBootstrap.includes("./admin.js?v=20260729-admin-consolidated-1")) {\n  errors.push('public/admin/admin-bootstrap.js: consolidated dashboard cache version is missing');\n}\nif (adminBootstrap.includes('admin-enhancements.js') || adminBootstrap.includes('admin-security-overrides.js')) {\n  errors.push('public/admin/admin-bootstrap.js: obsolete patch module import remains');\n}\n`
  );
  write(file, source);
}
