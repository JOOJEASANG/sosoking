import fs from "node:fs";
import path from "node:path";
import {build} from "esbuild";

const source=path.resolve("public"),target=path.resolve("dist-public");
for(const p of ["index.html","style.css","js/rules.js","js/game.js","js/renderer3d.js","mark.svg"]){
 if(!fs.existsSync(path.join(source,p)))throw new Error("Missing asset: "+p);
}
fs.rmSync(target,{recursive:true,force:true});
fs.cpSync(source,target,{recursive:true});
await build({
 entryPoints:[path.join(source,"js/game.js")],
 outfile:path.join(target,"js/game.js"),
 bundle:true,format:"esm",platform:"browser",target:"es2021",
 minify:true,legalComments:"none",sourcemap:false,
 logLevel:"warning"
});
console.log("RIFT GUARD 3D: bundled for Firebase Hosting.");
