import { readHandler } from 'api';

import { DELEGATION } from './config';

export interface DelegationPreference {
	walletTo: string;
	factor: number; // Percentage as integer (e.g., 1000 = 10%)
}

export interface DelegationLimits {
	currentPixlDelegation: number;
	totalOtherDelegations: number;
	maxPossibleDelegation: number;
}

/**
 * Get current delegations for a wallet address
 */
export async function getDelegations(walletAddress: string): Promise<DelegationPreference[]> {
	try {
		const result = await readHandler({
			processId: DELEGATION.DELEGATION_CONTROLLER,
			action: 'Get-Delegations',
			tags: [{ name: 'Wallet-From', value: walletAddress }],
		});

		if (result && result.Messages && result.Messages[0] && result.Messages[0].Data) {
			const delegationData = JSON.parse(result.Messages[0].Data);
			return delegationData.delegationPrefs || [];
		}

		return [];
	} catch (error) {
		console.error('Error fetching delegations:', error);
		return [];
	}
}

/**
 * Calculate delegation limits and current PIXL delegation
 */
export function calculateDelegationLimits(
	delegations: DelegationPreference[],
	pixlProcessId: string,
	walletAddress: string
): DelegationLimits {
	let totalOtherDelegations = 0;
	let currentPixlDelegation = 0;

	delegations.forEach((pref) => {
		if (pref.walletTo === pixlProcessId) {
			currentPixlDelegation = pref.factor / 100; // Convert to percentage
		} else {
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
}

/**
 * Set delegation for a specific token
 */
export async function setDelegation(
	walletAddress: string,
	tokenProcessId: string,
	percentage: number,
	adjustOthers: boolean = false
): Promise<boolean> {
	try {
		if (adjustOthers) {
			await adjustOtherDelegations(walletAddress, percentage);
		}

		// Set the main delegation
		const result = await readHandler({
			processId: DELEGATION.DELEGATION_CONTROLLER,
			action: 'Set-Delegation',
			tags: [
				{ name: 'Wallet-From', value: walletAddress },
				{ name: 'Wallet-To', value: tokenProcessId },
				{ name: 'Factor', value: (percentage * 100).toString() }, // Convert to integer
			],
		});

		return result && result.Messages && result.Messages.length > 0;
	} catch (error) {
		console.error('Error setting delegation:', error);
		return false;
	}
}

/**
 * Adjust other delegations to make room for new delegation
 */
async function adjustOtherDelegations(walletAddress: string, desiredPercentage: number): Promise<void> {
	try {
		const currentDelegations = await getDelegations(walletAddress);
		const availableSpace = 100 - desiredPercentage;

		// First, reduce delegations to other tokens
		for (const pref of currentDelegations) {
			if (pref.walletTo !== DELEGATION.PIXL_PROCESS) {
				await readHandler({
					processId: DELEGATION.DELEGATION_CONTROLLER,
					action: 'Set-Delegation',
					tags: [
						{ name: 'Wallet-From', value: walletAddress },
						{ name: 'Wallet-To', value: pref.walletTo },
						{ name: 'Factor', value: '0' }, // Remove delegation
					],
				});
			}
		}

		// Proportionally reduce other delegations
		const otherDelegationsTotal = currentDelegations
			.filter((pref) => pref.walletTo !== DELEGATION.PIXL_PROCESS)
			.reduce((sum, pref) => sum + pref.factor / 100, 0);

		if (otherDelegationsTotal > 0) {
			const reductionFactor = availableSpace / otherDelegationsTotal;

			for (const pref of currentDelegations) {
				if (pref.walletTo !== DELEGATION.PIXL_PROCESS) {
					const newPercentage = (pref.factor / 100) * reductionFactor;
					await readHandler({
						processId: DELEGATION.DELEGATION_CONTROLLER,
						action: 'Set-Delegation',
						tags: [
							{ name: 'Wallet-From', value: walletAddress },
							{ name: 'Wallet-To', value: pref.walletTo },
							{ name: 'Factor', value: (newPercentage * 100).toString() },
						],
					});
				}
			}
		}
	} catch (error) {
		console.error('Error adjusting other delegations:', error);
	}
}
