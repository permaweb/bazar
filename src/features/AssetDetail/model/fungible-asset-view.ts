// The fungible trading view is large; it loads as its own chunk when a token page is opened or warmed.
export function loadFungibleAssetView() {
	return import('../components/organisms/FungibleAssetView');
}
