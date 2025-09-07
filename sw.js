self.addEventListener('install', (event) => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

// Pass-through fetch (no caching). Keeps SW minimal to avoid 404s.
self.addEventListener('fetch', (event) => {
	event.respondWith(fetch(event.request));
}); 