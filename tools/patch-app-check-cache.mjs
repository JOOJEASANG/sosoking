import fs from 'node:fs';

function replace(file, before, after) {
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes(before)) throw new Error(`${file}: App Check cache patch target is missing.`);
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
}

replace(
  'firebase.json',
  `      {\n        "source": "/sw.js",`,
  `      {\n        "source": "/js/firebase-config.js",\n        "headers": [\n          {\n            "key": "Cache-Control",\n            "value": "no-cache, max-age=0, must-revalidate"\n          }\n        ]\n      },\n      {\n        "source": "/sw.js",`
);

replace(
  'public/sw.js',
  `  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/__/auth/')) return;\n\n  if (request.mode === 'navigate') {`,
  `  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/__/auth/')) return;\n\n  if (url.pathname === '/js/firebase-config.js') {\n    event.respondWith(networkFirst(request));\n    return;\n  }\n\n  if (request.mode === 'navigate') {`
);
