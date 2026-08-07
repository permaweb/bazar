#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import Arweave from 'arweave';

const root = path.resolve(import.meta.dirname, '..');
const walletPath = process.env.BAZAR_FUNGIBLE_WALLET ?? path.join(root, '.run-data', 'wallets', 'party-a.json');
const ledgerPath = path.join(root, '.run-data', 'fungible-token-ledger.json');
const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
const wallet = JSON.parse(await fs.readFile(walletPath, 'utf8'));
const holder = await arweave.wallets.jwkToAddress(wallet);

try {
	const existing = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
	if (existing.processId) {
		console.log(JSON.stringify(existing, null, 2));
		process.exit(0);
	}
} catch (error) {
	if (error?.code !== 'ENOENT') throw error;
}

const transaction = await arweave.createTransaction(
	{
		data: JSON.stringify({
			name: '[TEST] Weave Credit',
			ticker: 'WEAVE',
			description: 'One million 12-decimal test units for exercising Bazar’s Arweave-native fungible market.',
			collection: '[TEST] Bazar Fungible Tokens',
		}),
	},
	wallet
);
for (const [name, value] of Object.entries({
	'Content-Type': 'application/json',
	'App-Name': 'Bazar',
	'App-Version': '2.0.0',
	device: 'process@1.0',
	type: 'Process',
	'execution-device': 'token@1.0',
	'swap-device': 'arweave-swap@1.0',
	'scheduler-device': 'arweave-scheduler@1.0',
	'scheduler-mode': 'all',
	'initial-holder': holder,
	'total-supply': '1000000000000000000',
	denomination: '12',
	ticker: 'WEAVE',
	name: '[TEST] Weave Credit',
	description: 'One million 12-decimal test units for exercising Bazar’s Arweave-native fungible market.',
	collection: '[TEST] Bazar Fungible Tokens',
	'asset-type': 'fungible',
})) {
	transaction.addTag(name, value);
}

await arweave.transactions.sign(transaction, wallet);
const balanceBefore = BigInt(await arweave.wallets.getBalance(holder));
const cost = BigInt(transaction.reward);
if (cost > 1_000_000_000_000n || balanceBefore < cost) {
	throw new Error(`fungible-publication-budget:${cost}:${balanceBefore}`);
}

let response;
for (let attempt = 1; attempt <= 5; attempt += 1) {
	response = await arweave.transactions.post(transaction);
	if ([200, 202, 208].includes(response.status)) break;
	if (attempt === 5) throw new Error(`upload-${response.status}-${transaction.id}`);
	await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
}

const ledger = {
	processId: transaction.id,
	holder,
	name: '[TEST] Weave Credit',
	ticker: 'WEAVE',
	totalSupply: '1000000000000000000',
	denomination: 12,
	reward: transaction.reward,
	balanceBefore: balanceBefore.toString(),
	acceptedStatus: response.status,
	publishedAt: new Date().toISOString(),
};
await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(JSON.stringify(ledger, null, 2));
