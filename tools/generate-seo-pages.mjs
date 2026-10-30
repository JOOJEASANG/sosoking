import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const BASE='https://sosoking.co.kr';
const pages=JSON.parse(await readFile('tools/seo-programs.json','utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const raw=await readFile('index.html','utf8');
for(const page of pages){
 const canonical=BASE+'/programs/'+page.id+'/';
 const title=page.title+' | 소소킹 LIVE';
 const headMeta='<link rel="canonical" href="'+canonical+'">\n'
 +'<meta name="robots" content="index,follow,max-image-preview:large">\n'
 +'<meta property="og:type" content="website">\n'
 +'<meta property="og:url" content="'+canonical+'">\n'
 +'<meta property="og:image" content="'+BASE+'/social-preview.png">\n'
 +'<meta name="twitter:card" content="summary">\n'
 +'<meta name="twitter:title" content="'+esc(title)+'">\n'
 +'<meta name="twitter:description" content="'+esc(page.description)+'">';
 const schema={'@context':'https://schema.org','@type':'WebApplication',
  name:page.title,description:page.description,url:canonical,
  inLanguage:'ko-KR',operatingSystem:'Web browser',applicationCategory:'UtilitiesApplication',
  publisher:{'@type':'Organization',name:'소소킹 LIVE',url:BASE+'/'}};
 const staticContent='<div class="shell seo-static">'
 +'<nav aria-label="현재 위치"><a href="/">홈</a> / <a href="/#/tools">프로그램</a> / '+esc(page.title)+'</nav>'
 +'<h1>'+esc(page.title)+'</h1><p>'+esc(page.intro)+'</p>'
 +'<p><a href="'+canonical+'">무료로 '+esc(page.title)+' 실행하기</a></p>'
 +'<h2>이런 모임에서 사용해 보세요</h2><ul>'+page.use.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'
 +'<h2>사용 방법</h2><ol>'+page.steps.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>'
 +'<h2>주요 기능</h2><ul>'+page.facts.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'
 +'<h2>자주 묻는 질문</h2>'+page.faq.map(([q,a])=>'<h3>'+esc(q)+'</h3><p>'+esc(a)+'</p>').join('')
 +'<p><a href="/#/tools">다른 소소킹 프로그램 둘러보기</a></p></div>';
 let html=raw.replace(/<title>[\s\S]*?<\/title>/,'<title>'+esc(title)+'</title>');
 html=html.replace(/<link rel="canonical" href="[^"]*">/,'');
 html=html.replace(/<meta name="robots" content="[^"]*">/,'');
 html=html.replace(/<meta property="og:type" content="[^"]*">/,'');
 html=html.replace(/<meta property="og:url" content="[^"]*">/,'');
 html=html.replace(/<meta property="og:image" content="[^"]*">/,'');
 html=html.replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="'+esc(page.description)+'">');
 html=html.replace(/<meta property="og:title" content="[^"]*">/,'<meta property="og:title" content="'+esc(title)+'">');
 html=html.replace(/<meta property="og:description" content="[^"]*">/,'<meta property="og:description" content="'+esc(page.description)+'">');
 html=html.replace('</head>',headMeta+'\n<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>\n</head>');
 html=html.replace(/<main id="app" tabindex="-1">[\s\S]*?<\/main>/,'<main id="app" tabindex="-1">'+staticContent+'</main>');
 const dir=resolve('programs',page.id);
 await mkdir(dir,{recursive:true});
 await writeFile(resolve(dir,'index.html'),html,'utf8');
}
const urls=[BASE+'/',...pages.map(p=>BASE+'/programs/'+p.id+'/')];
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
 +urls.map(url=>'  <url><loc>'+esc(url)+'</loc></url>').join('\n')+'\n</urlset>\n';
await mkdir('public',{recursive:true});
await writeFile('public/sitemap.xml',sitemap,'utf8');
await writeFile('public/robots.txt','User-agent: *\nAllow: /\n\nSitemap: '+BASE+'/sitemap.xml\n','utf8');
console.log('Generated '+pages.length+' static SEO pages, robots.txt and sitemap.xml.');
