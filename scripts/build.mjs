import fs from "node:fs";
import path from "node:path";
const source=path.resolve("public"),target=path.resolve("dist-public");
for(const p of ["index.html","style.css","js/rules.js","js/game.js","mark.svg"]){
 if(!fs.existsSync(path.join(source,p)))throw new Error("Missing asset: "+p);
}
fs.rmSync(target,{recursive:true,force:true});
fs.cpSync(source,target,{recursive:true});
console.log("RIFT GUARD static build complete:",target);
