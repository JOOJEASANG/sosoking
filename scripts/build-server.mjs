import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
const root = new URL('../',import.meta.url);
const modules = ['public/js/rules.js','server/rooms.js','server/store.js','server/http.js'];
const sources = [];
for (const name of modules) {
  const source = await readFile(new URL(name,root),'utf8');
  sources.push(source.replace(/^import [^\n]+;\s*$/gm,'').replace(/^export (?!default )/gm,''));
}
await mkdir(new URL('dist/server/',root),{recursive:true});
await mkdir(new URL('dist/.openai/',root),{recursive:true});
await copyFile(new URL('.openai/hosting.json',root),new URL('dist/.openai/hosting.json',root));
await writeFile(new URL('dist/server/index.js',root),sources.join('\n'));
