const CACHE_NAME = 'bazar-static-v2';

self.addEventListener('install', (event) => {
	const indexUrl = new URL('index.html', self.registration.scope).href;
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.add(indexUrl))
			.catch(() => undefined)
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((names) =>
				Promise.all(
					names
						.filter((name) => name.startsWith('bazar-static-') && name !== CACHE_NAME)
						.map((name) => caches.delete(name))
				)
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET' || request.cache === 'no-store') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				const cache = await caches.open(CACHE_NAME);
				return (await cache.match(new URL('index.html', self.registration.scope).href)) || Response.error();
			})
		);
		return;
	}

	const staticAsset =
		['font', 'image', 'script', 'style'].includes(request.destination) ||
		/\.(?:css|gif|jpe?g|js|png|svg|webp|woff2?)$/i.test(url.pathname);
	if (!staticAsset) return;

	event.respondWith(
		caches.open(CACHE_NAME).then(async (cache) => {
			const cached = await cache.match(request);
			const update = fetch(request).then((response) => {
				if (response.ok) void cache.put(request, response.clone());
				return response;
			});
			if (cached) {
				event.waitUntil(update.catch(() => undefined));
				return cached;
			}
			return update;
		})
	);
});
