import { useState } from 'react';

export const useAppState = () => {
	const [showWalletModal, setShowWalletModal] = useState(false);

	return {
		showWalletModal,
		setShowWalletModal,
	};
};
