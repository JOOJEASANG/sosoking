import fs from 'node:fs';

function replace(file, before, after) {
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(before)) throw new Error(`${file}: target not found`);
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

replace(
  'tools/check-ui-audit.mjs',
  `const index = read('public/index.html');\nif (!index.includes("document.documentElement.setAttribute('data-theme', resolved)")) {\n  errors.push('index.html: first-paint theme resolution is missing');\n}`,
  `const index = read('public/index.html');\nconst themeInit = read('public/js/theme-init.js');\nif (!index.includes('/js/theme-init.js?v=')\n  || !themeInit.includes("document.documentElement.setAttribute('data-theme', resolved)")) {\n  errors.push('index.html/theme-init.js: external first-paint theme resolution is missing');\n}`
);

replace(
  'tools/check-security-regressions.mjs',
  `  'public/admin/admin-bootstrap.js'\n];`,
  `  'public/admin/admin-bootstrap.js',\n  'public/admin/admin.js'\n];`
);
