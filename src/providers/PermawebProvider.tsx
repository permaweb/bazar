import React from 'react';

import Arweave from 'arweave';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Permaweb from '@permaweb/libs';

import { useArweaveProvider } from './ArweaveProvider';

interface PermawebContextState {
	libs: any | null;
}

const PermawebContext = React.createContext<PermawebContextState>({
	libs: null,
});

export function usePermawebProvider(): PermawebContextState {
	return React.useContext(PermawebContext);
}

export function PermawebProvider(props: { children: React.ReactNode }) {
	const arProvider = useArweaveProvider();

	const [libs, setLibs] = React.useState<any>(null);

	React.useEffect(() => {
		const dependencies: any = { ao: connect(), arweave: Arweave.init({}) };
		if (arProvider.wallet) {
			dependencies.signer = createDataItemSigner(arProvider.wallet);
		}

		const permawebInstance = Permaweb.init(dependencies);
		setLibs(permawebInstance);
	}, [arProvider.wallet]);

	return <PermawebContext.Provider value={{ libs }}>{props.children}</PermawebContext.Provider>;
}
