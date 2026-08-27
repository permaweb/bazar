import React from 'react';
import { useWebWalletPresentation, WebWalletWindow } from '@permaweb/web-wallet/react';

import { hasInjectedPermawebWallet, resolveWebWalletConnectionUrl, webWalletClientProvider } from 'api/wallet';

import * as S from './styles';

type FrameSourceState = { status: 'ready'; source: string } | { status: 'error'; message: string };

export default function EmbeddedWallet() {
	const [isExtensionAvailable, setIsExtensionAvailable] = React.useState(
		() => typeof window !== 'undefined' && hasInjectedPermawebWallet(window)
	);
	const presentation = useWebWalletPresentation(webWalletClientProvider);
	const [transportError, setTransportError] = React.useState('');
	const frameSource = React.useMemo<FrameSourceState>(() => {
		if (typeof window === 'undefined') return { status: 'error', message: 'The wallet is unavailable.' };
		try {
			return { status: 'ready', source: resolveWebWalletConnectionUrl(window.location).href };
		} catch (error) {
			return {
				status: 'error',
				message: error instanceof Error ? error.message : 'The embedded wallet could not be opened.',
			};
		}
	}, []);

	const handleTransportError = React.useCallback((error: Error) => {
		setTransportError(error.message);
	}, []);

	React.useEffect(() => {
		function handleExtensionLoaded() {
			setIsExtensionAvailable(hasInjectedPermawebWallet(window));
		}

		window.addEventListener('permawebConnectLoaded', handleExtensionLoaded);
		return () => window.removeEventListener('permawebConnectLoaded', handleExtensionLoaded);
	}, []);

	if (isExtensionAvailable) return null;
	const isVisible = presentation.status !== 'hidden';
	const errorMessage = transportError || (frameSource.status === 'error' ? frameSource.message : '');

	if (frameSource.status === 'error' || transportError) {
		return (
			<S.Error $visible={isVisible} role="alert" aria-hidden={!isVisible}>
				{errorMessage}
			</S.Error>
		);
	}

	return (
		<WebWalletWindow
			provider={webWalletClientProvider}
			source={frameSource.source}
			title="PermawebOS Wallet"
			windowTitle="PermawebOS Wallet"
			closeLabel="Close"
			isOpen={isVisible}
			onTransportError={handleTransportError}
		/>
	);
}
