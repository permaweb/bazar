import { message } from '@permaweb/aoconnect';

import { createAoSignerForChain } from './dataItemSigner';
import { AO } from './config';

const DELEGATION = {
	CONTROLLER: AO.pixl,
	PIXL_PROCESS: AO.pixl,
	ANCHOR: '1234567890',
	BASIS_POINTS: {
		FULL: 10000,
	},
};

/**
 * Set delegation for PIXL token using ETH wallet
 * Adapted from delegationUtils.ts to support EVM signers
 */
export const setPixlDelegationEth = async (ethAddress: string, percentage: number): Promise<string> => {
	const signer = createAoSignerForChain('evm');
	const factor = percentage * 100;

	const data = JSON.stringify({
		walletFrom: ethAddress,
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

	// Wait for the message to be processed
	await new Promise((resolve) => setTimeout(resolve, 3000));

	return messageId;
};

/**
 * Unified delegation function that works with both Arweave and ETH wallets
 */
export const setDelegation = async (
	walletAddress: string,
	walletType: 'arweave' | 'evm',
	percentage: number
): Promise<string> => {
	const signer = createAoSignerForChain(walletType);
	const factor = percentage * 100;

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
			{ name: 'Wallet-Type', value: walletType },
		],
		anchor: DELEGATION.ANCHOR,
	});

	await new Promise((resolve) => setTimeout(resolve, 3000));

	return messageId;
};
