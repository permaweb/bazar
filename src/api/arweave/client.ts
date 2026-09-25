let arweaveModule: Promise<any> | undefined;

export async function createArweaveClient(config: Record<string, unknown> = {}) {
	arweaveModule ??= import('arweave');
	const loaded = await arweaveModule;
	const Arweave = loaded.default ?? loaded;
	return Arweave.init(config as any);
}
