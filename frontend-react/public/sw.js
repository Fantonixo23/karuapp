// TEMPORAL - Kill-switch para eliminar la PWA/Service Worker obsoleta.
//
// Este archivo NO es una PWA: no precachea nada ni intercepta requests. Solo
// existe para que los navegadores que tenían el Service Worker viejo registrado
// lo actualicen, borren sus caches y se desregistren solos.
//
// Una vez que los usuarios se hayan actualizado, este archivo se puede eliminar.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});
