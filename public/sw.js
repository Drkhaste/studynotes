const V='sn-v1',SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  const page=u.origin===location.origin&&(r.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('/'));
  const put=x=>{if(x.ok||x.type==='opaque'){const c=x.clone();caches.open(V).then(k=>k.put(r,c))}return x};
  if(page){e.respondWith(fetch(r).then(put).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));return}
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(put)));
});
