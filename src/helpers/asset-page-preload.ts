// The application registers the lazily loaded fungible asset page so shared cards, search, and
// navigation can warm it without depending on the feature that owns it.
let fungibleAssetViewLoader: (() => Promise<unknown>) | undefined;

export function registerFungibleAssetViewLoader(load: () => Promise<unknown>) {
	fungibleAssetViewLoader = load;
}

export function preloadFungibleAssetView() {
	void fungibleAssetViewLoader?.().catch(() => undefined);
}
