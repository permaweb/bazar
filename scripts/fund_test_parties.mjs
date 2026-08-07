#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Arweave from 'arweave';

const root = path.resolve(import.meta.dirname, '..');
const ledgerPath = path.join(root, '.run-data', 'publication-ledger.json');
const walletRoot = path.join(root, '.run-data', 'wallets');
const fundingKey = process.env.BAZAR_TEST_WALLET ?? path.join(os.homedir(), 'src', 'Documents', 'hyperbeam-key.json');
const targetBalance = 2_000_000_000_000n;
const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
const fundingWallet = JSON.parse(await fs.readFile(fundingKey, 'utf8'));
const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));

for (const label of ['party-a', 'party-b']) {
	const funded = ledger.transactions
		.filter((transaction) => transaction.kind === 'party-funding' && transaction.collection === label)
		.reduce((total, transaction) => total + BigInt(transaction.quantity), 0n);
	const amount = targetBalance - funded;
	if (amount <= 0n) continue;
	const wallet = JSON.parse(await fs.readFile(path.join(walletRoot, `${label}.json`), 'utf8'));
	const target = await arweave.wallets.jwkToAddress(wallet);
	const transaction = await arweave.createTransaction({ target, quantity: amount.toString() }, fundingWallet);
	transaction.addTag('App-Name', 'Bazar');
	transaction.addTag('App-Version', '2.0.0');
	transaction.addTag('Type', 'Test-Wallet-Funding');
	await arweave.transactions.sign(transaction, fundingWallet);
	const response = await arweave.transactions.post(transaction);
	if (![200, 202, 208].includes(response.status)) throw new Error(`funding-${response.status}`);
	ledger.transactions.push({
		id: transaction.id,
		kind: 'party-funding',
		collection: label,
		reward: transaction.reward,
		quantity: amount.toString(),
		target,
		bytes: transaction.data_size,
	});
	console.log(`${label} ${target} ${transaction.id}`);
}

ledger.endBalance = await arweave.wallets.getBalance(ledger.fundingAddress);
ledger.committedCost = ledger.transactions
	.reduce((total, transaction) => total + BigInt(transaction.reward) + BigInt(transaction.quantity ?? '0'), 0n)
	.toString();
if (BigInt(ledger.committedCost) > 50_000_000_000_000n) throw new Error('publication-budget-exceeded');
await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
