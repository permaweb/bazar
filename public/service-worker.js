const CACHE_NAME = 'bazar-bundle-cache-v1';
const ARNS_ID_KEY = 'bazar-arns-id';

const urlsToCache = ['/', '/index.html'];

self.addEventListener('install', (event) => {
	console.log('[Service Worker] Installing...');
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			console.log('[Service Worker] Caching initial files');
			return cache.addAll(urlsToCache);
		})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	console.log('[Service Worker] Activating...');
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						console.log('[Service Worker] Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip HEAD requests (used for ArNS ID checks)
	if (request.method !== 'GET') {
		return;
	}

	// Only cache same-origin requests for bundle files
	if (url.origin !== location.origin) {
		return;
	}

	// Skip requests with no-store cache directive
	if (request.cache === 'no-store') {
		return;
	}

	// Cache bundle files (JS, CSS, fonts, images, etc.)
	const isBundleFile =
		url.pathname.endsWith('.js') ||
		url.pathname.endsWith('.css') ||
		url.pathname.endsWith('.woff') ||
		url.pathname.endsWith('.woff2') ||
		url.pathname.endsWith('.ttf') ||
		url.pathname.endsWith('.svg') ||
		url.pathname.endsWith('.png') ||
		url.pathname.endsWith('.jpg') ||
		url.pathname.endsWith('.jpeg') ||
		url.pathname.endsWith('.webp') ||
		url.pathname.includes('/assets/');

	// Use cache-first for non-assets files to prevent flickering
	const isAssetFile = url.pathname.includes('/assets/');

	if (isBundleFile) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				// Cache-first strategy for non-assets (SVGs, fonts, etc.) to prevent flickering
				if (!isAssetFile && cachedResponse) {
					console.log('[Service Worker] Serving from cache:', request.url);
					// Update cache in background
					fetch(request)
						.then((response) => {
							if (response && response.status === 200 && response.type === 'basic') {
								caches.open(CACHE_NAME).then((cache) => {
									console.log('[Service Worker] Updating cache in background:', request.url);
									cache.put(request, response);
								});
							}
						})
						.catch((error) => {
							console.warn('[Service Worker] Background fetch failed:', request.url, error);
						});
					return cachedResponse;
				}

				// For assets: try cache first, then network (but only cache successful responses)
				if (isAssetFile && cachedResponse) {
					console.log('[Service Worker] Serving asset from cache:', request.url);
					// Update cache in background, removing bad cached responses
					fetch(request)
						.then((response) => {
							if (response && response.status === 200 && response.type === 'basic') {
								caches.open(CACHE_NAME).then((cache) => {
									console.log('[Service Worker] Updating asset cache in background:', request.url);
									cache.put(request, response);
								});
							} else {
								// Remove bad response from cache
								caches.open(CACHE_NAME).then((cache) => {
									console.log('[Service Worker] Removing failed asset from cache:', request.url);
									cache.delete(request);
								});
							}
						})
						.catch((error) => {
							console.warn('[Service Worker] Background fetch failed for asset:', request.url, error);
						});
					return cachedResponse;
				}

				// No cached response, fetch from network
				return fetch(request)
					.then((response) => {
						// Only cache successful responses
						if (response && response.status === 200 && response.type === 'basic') {
							const responseToCache = response.clone();
							caches.open(CACHE_NAME).then((cache) => {
								console.log('[Service Worker] Caching new file:', request.url);
								cache.put(request, responseToCache);
							});
						} else {
							console.warn('[Service Worker] Not caching failed response:', request.url, response.status);
						}
						return response;
					})
					.catch((error) => {
						console.warn('[Service Worker] Fetch failed for:', request.url, error);
						throw error;
					});
			})
		);
	}
});

// Listen for cache clear message from the main app
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'CLEAR_CACHE') {
		console.log('[Service Worker] Clearing all caches...');
		event.waitUntil(
			caches
				.keys()
				.then((cacheNames) => {
					return Promise.all(
						cacheNames.map((cacheName) => {
							console.log('[Service Worker] Deleting cache:', cacheName);
							return caches.delete(cacheName);
						})
					);
				})
				.then(() => {
					console.log('[Service Worker] All caches cleared');
					// Notify all clients that cache has been cleared
					self.clients.matchAll().then((clients) => {
						clients.forEach((client) => {
							client.postMessage({
								type: 'CACHE_CLEARED',
							});
						});
					});
				})
		);
	}
});
