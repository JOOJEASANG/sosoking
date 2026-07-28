import fs from 'node:fs';

const path = 'functions/legacy-case-migration.js';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    "      return { aliasRef, targetCaseId: aliasSnap.data().targetCaseId, reused: true };",
    "      return {\n        aliasRef,\n        targetCaseId: aliasSnap.data().targetCaseId,\n        aliasStatus: aliasSnap.data().status || 'processing',\n        reused: true\n      };"
  ],
  [
    "    return { aliasRef, targetCaseId: targetRef.id, reused: false };",
    "    return { aliasRef, targetCaseId: targetRef.id, aliasStatus: 'processing', reused: false };"
  ],
  [
    "    ...resultData,\n    idVersion: 2,\n    legacyIdHash: hash,\n    migratedAt: FieldValue.serverTimestamp(),",
    "    ...resultData,\n    idVersion: 2,\n    migratedAt: FieldValue.serverTimestamp(),"
  ],
  [
    "  const { aliasRef, targetCaseId, reused } = await reserveAlias(oldCaseId);\n  await copyPrimaryDocuments(oldCaseId, targetCaseId, hash);",
    "  const { aliasRef, targetCaseId, aliasStatus, reused } = await reserveAlias(oldCaseId);\n  if (aliasStatus === 'completed') {\n    const deleted = await removeLegacyDocuments(oldCaseId);\n    return {\n      legacyIdHash: hash,\n      targetCaseId,\n      migrated: true,\n      resumedCleanup: true,\n      deleted\n    };\n  }\n\n  await copyPrimaryDocuments(oldCaseId, targetCaseId, hash);"
  ]
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Patch target missing: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

fs.writeFileSync(path, source);
