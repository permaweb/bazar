export async function registerServiceWorker() {
	if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
	const script = new URL('service-worker.js', document.baseURI);
	const scope = new URL('.', document.baseURI).pathname;
	await navigator.serviceWorker.register(script, { scope });
}
