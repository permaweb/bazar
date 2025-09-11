import { connect, createDataItemSigner } from '@permaweb/aoconnect';

import { DELEGATION } from './config';

const { dryrun, message } = connect({
	MODE: 'legacy',
	MU_URL: 'https://mu.ao.xyz',
	CU_URL: 'https://cu.ao.xyz',
	GATEWAY_URL: 'https://arweave.net',
});

export interface DelegationPreference {
	walletTo: string;
	factor: number;
}

export interface DelegationLimits {
	currentPixlDelegation: number;
	totalOtherDelegations: number;
	maxPossibleDelegation: number;
}

export interface ProcessInfo {
	name: string;
	processId: string;
	logo?: string;
	ticker?: string;
	denomination?: number;
}

/**
 * Get current delegations for a wallet address
 */
export const getDelegations = async (walletAddress: string): Promise<DelegationPreference[]> => {
	try {
		const result = await dryrun({
			process: DELEGATION.CONTROLLER,
			data: walletAddress,
			tags: [
				{ name: 'Action', value: 'Get-Delegations' },
				{ name: 'Wallet', value: walletAddress },
				{ name: 'Data-Protocol', value: 'ao' },
				{ name: 'Type', value: 'Message' },
				{ name: 'Variant', value: 'ao.TN.1' },
			],
			anchor: DELEGATION.ANCHOR,
		});

		if (result?.Messages?.length > 0) {
			const delegationData = JSON.parse(result.Messages[0].Data);
			const delegations = delegationData.delegationPrefs || [];
			console.log('DEBUG: Fetched delegations:', delegations);
			console.log('DEBUG: Looking for PIXL process:', DELEGATION.PIXL_PROCESS);
			return delegations;
		}
		return [];
	} catch (error) {
		console.error('Error fetching delegations:', error);
		return [];
	}
};

/**
 * Calculate delegation limits and current state
 */
export const calculateDelegationLimits = (
	currentDelegations: DelegationPreference[],
	pixlProcessId: string = DELEGATION.PIXL_PROCESS,
	walletAddress?: string
): DelegationLimits => {
	let totalOtherDelegations = 0;
	let currentPixlDelegation = 0;

	currentDelegations.forEach((pref) => {
		if (pref.walletTo === pixlProcessId) {
			currentPixlDelegation = pref.factor / 100; // Convert to percentage
		} else if (pref.walletTo !== walletAddress) {
			// Don't count AO self-delegation as "other" - it's available space
			totalOtherDelegations += pref.factor / 100;
		}
	});

	// Maximum possible delegation without affecting others
	const maxPossibleDelegation = 100 - totalOtherDelegations;

	return {
		currentPixlDelegation,
		totalOtherDelegations,
		maxPossibleDelegation,
	};
};

/**
 * Set delegation for PIXL token
 */
export const setPixlDelegation = async (walletAddress: string, percentage: number): Promise<string> => {
	const signer = createDataItemSigner(window.arweaveWallet);
	const factor = percentage * 100;

	// 1. Get current delegations
	const currentDelegations = await getDelegations(walletAddress);

	// 2. Set the PIXL delegation (let AO system handle the remainder)
	const data = JSON.stringify({
		walletFrom: walletAddress,
		walletTo: DELEGATION.PIXL_PROCESS,
		factor: factor,
	});

	const messageId = await message({
		process: DELEGATION.CONTROLLER,
		signer: signer,
		data: data,
		tags: [
			{ name: 'Action', value: 'Set-Delegation' },
			{ name: 'Data-Protocol', value: 'ao' },
			{ name: 'Type', value: 'Message' },
			{ name: 'Variant', value: 'ao.TN.1' },
		],
		anchor: DELEGATION.ANCHOR,
	});

	// 3. Wait for the message to be processed
	await new Promise((resolve) => setTimeout(resolve, 3000));

	// 4. Verify the final state
	const finalDelegations = await getDelegations(walletAddress);

	// Calculate total from final state
	const totalFactor = finalDelegations.reduce((sum, pref) => sum + pref.factor, 0);

	return messageId;
};

/**
 * Adjust other delegations to make room for PIXL
 */
export const adjustOtherDelegations = async (walletAddress: string, desiredPercentage: number): Promise<void> => {
	const currentDelegations = await getDelegations(walletAddress);
	const signer = createDataItemSigner(window.arweaveWallet);

	// If user wants 100%, zero out all others
	if (desiredPercentage === 100) {
		for (const pref of currentDelegations) {
			if (pref.walletTo !== DELEGATION.PIXL_PROCESS) {
				await message({
					process: DELEGATION.CONTROLLER,
					signer: signer,
					data: JSON.stringify({
						walletFrom: walletAddress,
						walletTo: pref.walletTo,
						factor: 0,
					}),
					tags: [
						{ name: 'Action', value: 'Set-Delegation' },
						{ name: 'Data-Protocol', value: 'ao' },
						{ name: 'Type', value: 'Message' },
						{ name: 'Variant', value: 'ao.TN.1' },
					],
					anchor: DELEGATION.ANCHOR,
				});
			}
		}
	} else {
		// Proportionally reduce other delegations
		const otherDelegationsTotal = currentDelegations
			.filter((pref) => pref.walletTo !== DELEGATION.PIXL_PROCESS)
			.reduce((sum, pref) => sum + pref.factor, 0);

		const availableSpace = DELEGATION.BASIS_POINTS.FULL - desiredPercentage * 100;
		const reductionFactor = availableSpace / otherDelegationsTotal;

		for (const pref of currentDelegations) {
			if (pref.walletTo !== DELEGATION.PIXL_PROCESS) {
				const newFactor = Math.floor(pref.factor * reductionFactor);
				await message({
					process: DELEGATION.CONTROLLER,
					signer: signer,
					data: JSON.stringify({
						walletFrom: walletAddress,
						walletTo: pref.walletTo,
						factor: newFactor,
					}),
					tags: [
						{ name: 'Action', value: 'Set-Delegation' },
						{ name: 'Data-Protocol', value: 'ao' },
						{ name: 'Type', value: 'Message' },
						{ name: 'Variant', value: 'ao.TN.1' },
					],
					anchor: DELEGATION.ANCHOR,
				});
			}
		}
	}
};

/**
 * Get process information for delegation display
 */

export const getProcessInfo = async (processId: string): Promise<ProcessInfo> => {
	try {
		const result = await dryrun({
			process: processId,
			data: '',
			tags: [{ name: 'Action', value: 'Info' }],
		});

		if (result?.Messages?.length > 0) {
			const tags = result.Messages[0].Tags;
			const nameTag = tags.find((tag) => tag.name === 'Token-Name');
			const logoTag = tags.find((tag) => tag.name === 'Logo');
			const tokenLogoTag = tags.find((tag) => tag.name === 'Token-Logo');
			const tickerTag = tags.find((tag) => tag.name === 'Ticker');
			const denominationTag = tags.find((tag) => tag.name === 'Denomination');
			const tokenProcessTag = tags.find((tag) => tag.name === 'Token-Process');

			const logoValue = logoTag?.value || tokenLogoTag?.value;

			return {
				name: nameTag?.value || `${processId.substring(0, 6)}...`,
				processId,
				logo: logoValue,
				ticker: tickerTag?.value,
				denomination: denominationTag?.value ? parseInt(denominationTag.value) : undefined,
				// Add Token-Process for asset linking
				...(tokenProcessTag ? { ['Token-Process']: tokenProcessTag.value } : {}),
			};
		}
	} catch (error) {
		console.error('Error fetching process info:', error);
	}
	return {
		name: `${processId.substring(0, 6)}...`,
		processId,
	};
};

/**
 * Convert basis points to percentage
 */
export const basisPointsToPercentage = (basisPoints: number): number => {
	return basisPoints / 100;
};

/**
 * Convert percentage to basis points
 */
export const percentageToBasisPoints = (percentage: number): number => {
	return percentage * 100;
};
