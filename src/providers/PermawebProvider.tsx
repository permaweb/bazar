import React from 'react';
import Permaweb from '@permaweb/libs';

import Arweave from 'arweave';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';

import { AO } from 'helpers/config';

import { useArweaveProvider } from './ArweaveProvider';

interface PermawebContextState {
	libs: any | null;
	hyperbeam: any | null;
}

const PermawebContext = React.createContext<PermawebContextState>({
	libs: null,
	hyperbeam: null,
});

export function usePermawebProvider(): PermawebContextState {
	return React.useContext(PermawebContext);
}

export function PermawebProvider(props: { children: React.ReactNode }) {
	const arProvider = useArweaveProvider();

	const [libs, setLibs] = React.useState<any>(null);
	const [hyperbeam, setHyperbeam] = React.useState<any>(null);

	React.useEffect(() => {
		const initializeProviders = async () => {
			try {
				// Initialize AO connection with custom node
				const ao = connect({
					MODE: 'legacy',
					GATEWAY_URL: 'https://arweave.net',
					CU_URL: 'https://cu.arweave.net',
				});

				// Initialize Arweave
				const arweave = Arweave.init({
					host: 'arweave.net',
					port: 443,
					protocol: 'https',
				});

				// Initialize dependencies
				const dependencies: any = {
					ao,
					arweave,
				};

				// Add signer if wallet is available
				if (arProvider.wallet) {
					dependencies.signer = createDataItemSigner(arProvider.wallet);
				}

				// Initialize Permaweb
				const permawebInstance = Permaweb.init(dependencies);
				setLibs(permawebInstance);

				// Initialize Hyperbeam
				const hyperbeamInstance = await ao.spawn({
					module: AO.module,
					scheduler: AO.scheduler,
					tags: [
						{ name: 'Data-Protocol', value: 'ao' },
						{ name: 'Type', value: 'Process' },
						{ name: 'Variant', value: 'Hyperbeam' },
					],
				});

				setHyperbeam(hyperbeamInstance);
			} catch (error) {
				console.error('Error initializing providers:', error);
			}
		};

		initializeProviders();
	}, [arProvider.wallet]);

	return <PermawebContext.Provider value={{ libs, hyperbeam }}>{props.children}</PermawebContext.Provider>;
}
