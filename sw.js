/* Basket service worker — v3
   Network-first for the app itself, so a new build always wins.
   Cache is only a fallback for when you are offline. */
var CACHE = 'basket-v3';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(SHELL.map(function(u){
      return c.add(new Request(u, {cache:'reload'})).catch(function(){});
    }));
  }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('message', function(e){
  if (e.data === 'skipWaiting') self.skipWaiting();
});

function isAppShell(req){
  if (req.mode === 'navigate') return true;
  var p = new URL(req.url).pathname;
  return /(\/|\.html|\.js|\.json)$/.test(p);
}

self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;

  /* App files: try the network first so updates land immediately.
     Fall back to the cached copy only when the network fails. */
  if (isAppShell(e.request)) {
    e.respondWith(
      fetch(e.request).then(function(res){
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(e.request).then(function(hit){
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  /* Everything else (icons): cache first, it never changes. */
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if (hit) return hit;
      return fetch(e.request).then(function(res){
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});
