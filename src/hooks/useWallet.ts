import { useEffect, useState } from 'react';

export const useWallet = () => {
	const [isConnected, setIsConnected] = useState(false);

	return {
		isConnected,
		setIsConnected,
	};
};
