/* The Reading Room – service worker (offline support).
   - index.html: network-first (new versions arrive when online), cache fallback offline.
   - Icon and Google Fonts: cache-first.
   - Bump VERSION when you want to force-clear old caches. */
const VERSION="rr-v3-1";
const CORE=["./","./index.html","./apple-touch-icon.png"];
const FONT_CSS="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,500&display=swap";

self.addEventListener("install",e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VERSION);
    await Promise.all(CORE.map(u=>c.add(new Request(u,{cache:"reload"})).catch(()=>{})));
    // Fonts are also cached on first use; pre-caching here just makes offline work sooner.
    try{const r=await fetch(FONT_CSS,{mode:"cors",credentials:"omit"});if(r.ok)await c.put(FONT_CSS,r)}catch(err){}
    self.skipWaiting();
  })());
});
self.addEventListener("activate",e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==VERSION)await caches.delete(k);
    await self.clients.claim();
  })());
});
function isPage(req,url){return req.mode==="navigate"||(url.origin===location.origin&&/\/(index\.html)?$/.test(url.pathname))}
async function networkFirst(req){
  const c=await caches.open(VERSION);
  try{
    const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),6000);
    const res=await fetch(req,{signal:ctrl.signal,cache:"no-cache"});clearTimeout(t);
    if(res&&res.ok){c.put("./index.html",res.clone())}
    return res;
  }catch(err){
    return (await c.match("./index.html"))||(await c.match("./"))||Response.error();
  }
}
async function cacheFirst(req){
  const c=await caches.open(VERSION);
  const hit=await c.match(req.url,{ignoreVary:true});if(hit)return hit;
  try{
    // Google Fonts allow CORS, so fetch in cors mode and cache only real successes (never an opaque error).
    const font=/fonts\.(googleapis|gstatic)\.com$/.test(new URL(req.url).hostname);
    const res=await fetch(font?new Request(req.url,{mode:"cors",credentials:"omit"}):req);
    if(res&&res.ok)c.put(req.url,res.clone());
    return res}
  catch(err){return hit||Response.error()}
}
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(isPage(req,url)){e.respondWith(networkFirst(req));return}
  if(url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com"||url.pathname.endsWith("/apple-touch-icon.png")){e.respondWith(cacheFirst(req));return}
  if(url.origin===location.origin)e.respondWith(fetch(req).catch(async()=>(await caches.match(req))||Response.error()));
});
