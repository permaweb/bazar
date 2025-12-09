import { createDataItemSigner } from '@permaweb/aoconnect';

import { messageResult } from 'api';

interface AgentClaimResponse {
	success: boolean;
	message: string;
	claimId?: string;
}

export async function handleAgentClaim(
	assetId: string,
	agentId: string,
	walletAddress: string,
	profileId: string
): Promise<AgentClaimResponse> {
	try {
		// First verify the agent has permission to claim
		const agentVerification = await messageResult({
			processId: assetId,
			wallet: window.arweaveWallet,
			action: 'Verify-Agent',
			tags: [
				{ name: 'Agent-ID', value: agentId },
				{ name: 'Address', value: walletAddress },
				{ name: 'ProfileId', value: profileId },
			],
			data: null,
		});

		if (agentVerification?.['Verify-Agent']?.status !== 'Valid') {
			throw new Error('Agent verification failed');
		}

		// Proceed with the claim using the agent
		const claimResult = await messageResult({
			processId: assetId,
			wallet: window.arweaveWallet,
			action: 'Handle-Agent-Claim',
			tags: [
				{ name: 'Agent-ID', value: agentId },
				{ name: 'Address', value: walletAddress },
				{ name: 'ProfileId', value: profileId },
			],
			data: {
				Target: assetId,
				Action: 'Transfer',
			},
		});

		if (claimResult?.['Claim-Status-Response']?.status === 'Claimed') {
			return {
				success: true,
				message: 'Successfully claimed through agent',
				claimId: claimResult['Claim-Status-Response'].id,
			};
		} else {
			throw new Error(claimResult?.['Claim-Status-Response']?.message || 'Claim failed');
		}
	} catch (error) {
		console.error('Agent claim error:', error);
		return {
			success: false,
			message: error.message || 'Failed to claim through agent',
		};
	}
}
