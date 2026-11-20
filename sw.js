const prefix='ruidolab:'+self.registration.scope+':',name=prefix+'v1';
const assets=['./','./index.html','./style.css','./icon.svg','./manifest.webmanifest','./src/app.js','./src/core.js','./src/view.js','./src/storage.js','./src/report.js','./src/zip.js','./ejemplos/sonometro.csv'];
self.addEventListener('install',e=>e.waitUntil(caches.open(name).then(c=>c.addAll(assets))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(prefix)&&k!==name).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||!r.url.startsWith(self.registration.scope))return;
  if(!assets.some(a=>new URL(a,self.registration.scope).href===r.url)&&r.mode!=='navigate')return;
  e.respondWith(fetch(r).then(res=>res.ok?res:Promise.reject(Error('sin respuesta'))).catch(()=>caches.open(name).then(async c=>(await c.match(r))||(r.mode==='navigate'?await c.match('./index.html'):undefined)||Response.error())));
});
