#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Arweave from 'arweave';

const root = path.resolve(import.meta.dirname, '..');
const dataRoot = path.join(root, '.run-data');
const collectionRoot = path.join(dataRoot, 'collections');
const walletRoot = path.join(dataRoot, 'wallets');
const ledgerPath = path.join(dataRoot, 'publication-ledger.json');
const fundingKey =
	process.env.BAZAR_TEST_WALLET ??
	path.join(os.homedir(), 'src', 'Documents', 'hyperbeam-key.json');
const budget = 50_000_000_000_000n;
const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });

const definitions = [
	{
		slug: 'strata',
		name: '[TEST] Permanent Strata',
	},
	{
		slug: 'signals',
		name: '[TEST] Weave Signals',
	},
];

async function main() {
	await fs.mkdir(walletRoot, { recursive: true });
	const fundingWallet = JSON.parse(await fs.readFile(fundingKey, 'utf8'));
	const fundingAddress = await arweave.wallets.jwkToAddress(fundingWallet);
	const startBalance = BigInt(await arweave.wallets.getBalance(fundingAddress));
	const ledger = await readJson(ledgerPath, {
		fundingAddress,
		startBalance: startBalance.toString(),
		transactions: [],
		collections: {},
	});
	let committedCost = ledger.transactions.reduce((sum, transaction) => sum + BigInt(transaction.reward), 0n);

	const parties = [];
	for (const label of ['party-a', 'party-b']) {
		const walletPath = path.join(walletRoot, `${label}.json`);
		let wallet;
		try {
			wallet = await readJson(walletPath);
		} catch {
			wallet = await arweave.wallets.generate();
			await fs.writeFile(walletPath, `${JSON.stringify(wallet)}\n`, { mode: 0o600 });
		}
		parties.push({ label, wallet, address: await arweave.wallets.jwkToAddress(wallet) });
	}

	for (const definition of definitions) {
		const localManifest = await readJson(path.join(collectionRoot, definition.slug, 'manifest.local.json'));
		const published = ledger.collections[definition.slug] ?? { assets: [] };
		for (const source of localManifest.assets) {
			if (published.assets.some((asset) => asset.index === source.index)) continue;
			const bytes = await fs.readFile(path.join(collectionRoot, definition.slug, source.filename));
			const transaction = await arweave.createTransaction({ data: bytes }, fundingWallet);
			addTags(transaction, {
				'Content-Type': 'image/png',
				'App-Name': 'Bazar',
				'App-Version': '2.0.0',
				type: 'Collection-Media',
				name: source.name,
				collection: definition.name,
				'collection-index': String(source.index),
			});
			await publish(transaction, fundingWallet);
			committedCost += BigInt(transaction.reward);
			assertBudget(committedCost);
			const asset = {
				index: source.index,
				id: transaction.id,
				name: source.name,
				contentType: 'image/png',
				image: `https://arweave.net/${transaction.id}`,
			};
			published.assets.push(asset);
			ledger.transactions.push(record(transaction, 'media', definition.slug));
			ledger.collections[definition.slug] = published;
			await writeLedger(ledger);
			console.log(`${definition.slug} ${source.index}/100 ${transaction.id}`);
		}
	}

	ledger.parties = parties.map(({ label, address }) => ({ label, address }));
	ledger.committedCost = committedCost.toString();
	ledger.endBalance = await arweave.wallets.getBalance(fundingAddress);
	await writeLedger(ledger);
	console.log(JSON.stringify({
		fundingAddress,
		startBalance: ledger.startBalance,
		currentBalance: ledger.endBalance,
		committedCost: ledger.committedCost,
		parties: ledger.parties,
		collections: Object.fromEntries(
			Object.entries(ledger.collections).map(([slug, collection]) => [
				slug,
				{ media: collection.assets.length },
			])
		),
	}, null, 2));
}

function addTags(transaction, tags) {
	for (const [name, value] of Object.entries(tags)) transaction.addTag(name, String(value));
}

async function publish(transaction, wallet) {
	await arweave.transactions.sign(transaction, wallet);
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		const response = await arweave.transactions.post(transaction);
		if ([200, 202, 208].includes(response.status)) return;
		if (attempt === 5) throw new Error(`upload-${response.status}-${transaction.id}`);
		await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
	}
}

function record(transaction, kind, collection) {
	return {
		id: transaction.id,
		kind,
		collection,
		reward: transaction.reward,
		bytes: transaction.data_size,
	};
}

function assertBudget(cost) {
	if (cost > budget) throw new Error(`publication-budget-exceeded-${cost}`);
}

async function readJson(filename, fallback) {
	try {
		return JSON.parse(await fs.readFile(filename, 'utf8'));
	} catch (error) {
		if (fallback !== undefined && error.code === 'ENOENT') return fallback;
		throw error;
	}
}

async function writeLedger(ledger) {
	await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

await main();
