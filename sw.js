/* Service worker do Ouvido Absoluto (escopo: a pasta do repositório).
   Página: rede primeiro (atualizações chegam na hora), cache se estiver offline.
   Manifesto e ícones: cache primeiro. Ao adicionar arquivos, troque a versão do CACHE. */
const CACHE='ouvido-v2';
const ARQS=['manifest.webmanifest','icon-192.png','icon-512.png','icon-512-maskable.png'];
const PAGINA='index.html';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all([PAGINA,...ARQS].map(a=>c.add(a).catch(()=>null)))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('ouvido-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(e.request.mode==='navigate'||url.pathname.endsWith('/')||url.pathname.endsWith('/'+PAGINA)){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(k=>k.put(PAGINA,c));}return r;})
      .catch(()=>caches.match(PAGINA)));
    return;
  }
  const a=ARQS.find(x=>url.pathname.endsWith('/'+x));if(!a)return;
  e.respondWith(caches.match(a).then(h=>h||fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(k=>k.put(a,c));return r;})));
});
