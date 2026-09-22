let transactionSyncRuntime: Promise<typeof import('../components/organisms/ArweaveTransactionSync')> | undefined;

export function loadArweaveTransactionSync() {
	transactionSyncRuntime ??= import('../components/organisms/ArweaveTransactionSync').catch((cause) => {
		transactionSyncRuntime = undefined;
		throw cause;
	});
	return transactionSyncRuntime;
}

export function preloadArweaveTransactionSync() {
	void loadArweaveTransactionSync().catch(() => undefined);
}
