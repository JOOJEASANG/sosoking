import fs from 'node:fs';

const path = 'firebase.json';
let source = fs.readFileSync(path, 'utf8');
const configRule = `      {\n        "source": "/js/firebase-config.js",\n        "headers": [\n          {\n            "key": "Cache-Control",\n            "value": "no-cache, max-age=0, must-revalidate"\n          }\n        ]\n      },\n`;
if (!source.includes(configRule)) throw new Error('firebase-config header rule is missing');
source = source.replace(configRule, '');
const webManifestRule = `      {\n        "source": "/site.webmanifest",`;
if (!source.includes(webManifestRule)) throw new Error('site.webmanifest header rule is missing');
source = source.replace(webManifestRule, `${configRule}${webManifestRule}`);
fs.writeFileSync(path, source);
