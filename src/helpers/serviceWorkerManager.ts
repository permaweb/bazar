const ARNS_ID_KEY = 'bazar-arns-id';

export class ServiceWorkerManager {
	private static instance: ServiceWorkerManager;
	private registration: ServiceWorkerRegistration | null = null;

	private constructor() {}

	static getInstance(): ServiceWorkerManager {
		if (!ServiceWorkerManager.instance) {
			ServiceWorkerManager.instance = new ServiceWorkerManager();
		}
		return ServiceWorkerManager.instance;
	}

	async register(): Promise<void> {
		if (!('serviceWorker' in navigator)) {
			console.warn('[ServiceWorkerManager] Not supported in this browser');
			return;
		}

		// Skip registration on localhost
		if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
			console.info('[ServiceWorkerManager] Skipping registration on localhost');
			return;
		}

		try {
			this.registration = await navigator.serviceWorker.register('/service-worker.js', {
				scope: '/',
			});

			console.info('[ServiceWorkerManager] Registered successfully');

			// Listen for messages from the service worker
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (event.data && event.data.type === 'CACHE_CLEARED') {
					console.info('[ServiceWorkerManager] Cache cleared, reloading page...');
					window.location.reload();
				}
			});

			// Check for updates
			this.registration.addEventListener('updatefound', () => {
				console.info('[ServiceWorkerManager] Update found');
			});
		} catch (error) {
			console.error('[ServiceWorkerManager] Registration failed:', error);
		}
	}

	async checkArNSUpdate(): Promise<void> {
		// Skip on localhost
		if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
			console.info('[ServiceWorkerManager] Skipping ArNS update check on localhost');
			return;
		}

		try {
			// Fetch the current ArNS ID from the response headers
			const response = await fetch(`https://${window.location.host}`, {
				method: 'HEAD',
				cache: 'no-store',
			});

			const currentArnsId = response.headers.get('X-Arns-Resolved-Id');

			if (!currentArnsId) {
				console.warn('[ServiceWorkerManager] No X-Arns-Resolved-Id header found');
				return;
			}

			// Get the stored ArNS ID
			const storedArnsId = localStorage.getItem(ARNS_ID_KEY);

			if (!storedArnsId) {
				// First time - store the ID
				localStorage.setItem(ARNS_ID_KEY, currentArnsId);
				console.info('[ServiceWorkerManager] Stored initial ArNS ID:', currentArnsId);
				return;
			}

			if (storedArnsId !== currentArnsId) {
				console.info('[ServiceWorkerManager] ArNS ID changed from', storedArnsId, 'to', currentArnsId);
				console.info('[ServiceWorkerManager] Clearing cache and reloading...');

				// Update the stored ID
				localStorage.setItem(ARNS_ID_KEY, currentArnsId);

				// Clear the service worker cache
				await this.clearCache();
			} else {
				console.info('[ServiceWorkerManager] ArNS ID unchanged:', currentArnsId);
			}
		} catch (error) {
			console.error('[ServiceWorkerManager] Error checking for updates:', error);
		}
	}

	async clearCache(): Promise<void> {
		if (!this.registration) {
			console.warn('[ServiceWorkerManager] Not registered, cannot clear cache');
			return;
		}

		// Send message to service worker to clear cache
		if (this.registration.active) {
			this.registration.active.postMessage({
				type: 'CLEAR_CACHE',
			});
			console.info('[ServiceWorkerManager] Sent clear cache message');
		}
	}

	async unregister(): Promise<void> {
		if (!this.registration) {
			return;
		}

		try {
			await this.registration.unregister();
			console.info('[ServiceWorkerManager] Unregistered successfully');
			this.registration = null;
		} catch (error) {
			console.error('[ServiceWorkerManager] Unregistration failed:', error);
		}
	}
}

export const serviceWorkerManager = ServiceWorkerManager.getInstance();
