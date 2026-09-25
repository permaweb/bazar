// The mint client and uploader load on demand so browsing never pays for minting code.
export function loadMintRuntime() {
	return import('./adapter');
}
