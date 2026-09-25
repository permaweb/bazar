import React from 'react';

import { loadArweaveTransactionSync } from '../../../model/runtime';

export const LazyArweaveTransactionSync = React.lazy(async () => {
	const module = await loadArweaveTransactionSync();
	return { default: module.ArweaveTransactionSync };
});

export default LazyArweaveTransactionSync;
