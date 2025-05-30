import { usePermawebProvider } from '../providers/PermawebProvider';

export function useHyperbeam() {
	const { hyperbeam } = usePermawebProvider();

	const sendMessage = async (action: string, data?: any) => {
		if (!hyperbeam) {
			throw new Error('Hyperbeam not initialized');
		}

		try {
			const result = await hyperbeam.message({
				action,
				data,
			});
			return result;
		} catch (error) {
			console.error('Error sending message to Hyperbeam:', error);
			throw error;
		}
	};

	const dryRun = async (action: string, data?: any) => {
		if (!hyperbeam) {
			throw new Error('Hyperbeam not initialized');
		}

		try {
			const result = await hyperbeam.dryrun({
				action,
				data,
			});
			return result;
		} catch (error) {
			console.error('Error performing dry run:', error);
			throw error;
		}
	};

	const getState = async () => {
		if (!hyperbeam) {
			throw new Error('Hyperbeam not initialized');
		}

		try {
			const result = await hyperbeam.message({
				action: 'Get-State',
			});
			return result;
		} catch (error) {
			console.error('Error getting Hyperbeam state:', error);
			throw error;
		}
	};

	return {
		hyperbeam,
		sendMessage,
		dryRun,
		getState,
	};
}
