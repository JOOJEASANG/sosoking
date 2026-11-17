import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve("public");
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".json":"application/json"};
const port=Number(process.env.PORT||3000);
http.createServer((req,res)=>{
 const url=new URL(req.url,"http://localhost:"+port);
 let p=path.normalize(path.join(root,decodeURIComponent(url.pathname)));
 if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403);res.end();return;}
 if(p===root||!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(root,"index.html");
 const data=fs.readFileSync(p);
 res.writeHead(200,{"Content-Type":types[path.extname(p)]||"application/octet-stream","Cache-Control":"no-store"});
 res.end(data);
}).listen(port,()=>console.log("RIFT GUARD dev server: http://localhost:"+port));
