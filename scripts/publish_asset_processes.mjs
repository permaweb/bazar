#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import Arweave from 'arweave';

const root = path.resolve(import.meta.dirname, '..');
const ledgerPath = path.join(root, '.run-data', 'publication-ledger.json');
const fundingKey = process.env.BAZAR_TEST_WALLET ?? path.join(os.homedir(), 'src', 'Documents', 'hyperbeam-key.json');
const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
const wallet = JSON.parse(await fs.readFile(fundingKey, 'utf8'));
const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
const parties = Object.fromEntries(ledger.parties.map((party) => [party.label, party.address]));
const definitions = [
	{
		slug: 'strata',
		name: '[TEST] Permanent Strata',
		description: 'One hundred views into a geological archive of permanent data.',
		holder: parties['party-a'],
	},
	{
		slug: 'signals',
		name: '[TEST] Weave Signals',
		description: 'One hundred signals moving through a decentralized network.',
		holder: parties['party-b'],
	},
];

for (const definition of definitions) {
	const collection = ledger.collections[definition.slug];
	collection.processes ??= [];
	for (const media of collection.assets) {
		if (collection.processes.some((asset) => asset.index === media.index)) continue;
		const response = await fetch(`https://arweave.net/raw/${media.id}`);
		if (!response.ok) throw new Error(`asset-media-${response.status}-${media.id}`);
		const transaction = await arweave.createTransaction(
			{ data: new Uint8Array(await response.arrayBuffer()) },
			wallet
		);
		addTags(transaction, {
			'content-type': 'image/png',
			'hint-ui-style': 'non-fungible',
			creator: ledger.fundingAddress,
			description: `${definition.name} on Bazar`,
			implements: 'ANS-110',
			title: media.name,
			device: 'process@1.0',
			type: 'Process',
			'execution-device': 'token@1.0',
			'swap-device': 'arweave-swap@1.0',
			'scheduler-device': 'arweave-scheduler@1.0',
			'scheduler-mode': 'all',
			'initial-holder': definition.holder,
			'total-supply': '1',
			denomination: '0',
			ticker: 'ASSET',
			name: media.name,
			'base-collection': definition.name,
			'collection-index': media.index,
		});
		await publish(transaction);
		const asset = {
			index: media.index,
			id: transaction.id,
			name: media.name,
			contentType: 'image/png',
			image: `https://arweave.net/raw/${transaction.id}`,
			mediaId: transaction.id,
		};
		collection.processes.push(asset);
		ledger.transactions.push(record(transaction, 'asset-process', definition.slug));
		await save();
		console.log(`${definition.slug} ${media.index}/100 ${transaction.id}`);
	}

	if (!collection.processManifestId) {
		const manifest = await arweave.createTransaction(
			{
				data: JSON.stringify({
					version: 2,
					name: definition.name,
					description: definition.description,
					kind: 'arweave-native-token-assets',
					assetCount: collection.processes.length,
					assets: collection.processes
						.sort((left, right) => left.index - right.index)
						.map((asset) => asset.id),
				}),
			},
			wallet
		);
		addTags(manifest, {
			'content-type': 'application/json',
			type: 'Collection-Manifest',
			name: definition.name,
		});
		await publish(manifest);
		collection.processManifestId = manifest.id;
		ledger.transactions.push(record(manifest, 'process-manifest', definition.slug));
		await save();
	}

	collection.carrierId ??= collection.processReferenceId;
	if (!collection.carrierId) {
		const carrier = await arweave.createTransaction({ data: 'Bazar collection process' }, wallet);
		addTags(carrier, {
			device: 'process@1.0',
			'execution-device': 'carrier@1.0',
			'scheduler-device': 'arweave-scheduler@1.0',
			'scheduler-mode': 'all',
			'initial-holder': ledger.fundingAddress,
			'initial-value': collection.processManifestId,
			'total-supply': '1',
			denomination: '0',
			ticker: 'COLLECTION',
			type: 'Process',
			name: definition.name,
		});
		await publish(carrier);
		collection.carrierId = carrier.id;
		ledger.transactions.push(record(carrier, 'collection-carrier-process', definition.slug));
		await save();
	}
}

ledger.endBalance = await arweave.wallets.getBalance(ledger.fundingAddress);
ledger.committedCost = totalCost().toString();
assertBudget();
await save();
console.log(
	JSON.stringify(
		Object.fromEntries(
			Object.entries(ledger.collections).map(([slug, collection]) => [
				slug,
				{
					assets: collection.processes.length,
					manifestId: collection.processManifestId,
					processId: collection.carrierId,
				},
			])
		),
		null,
		2
	)
);

function addTags(transaction, tags) {
	const normalized = new Set();
	for (const [rawName, value] of Object.entries(tags)) {
		const name = rawName.toLowerCase();
		if (normalized.has(name)) throw new Error(`duplicate-upload-tag-${name}`);
		normalized.add(name);
		transaction.addTag(name, String(value));
	}
}

async function publish(transaction) {
	await arweave.transactions.sign(transaction, wallet);
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		const response = await arweave.transactions.post(transaction);
		if ([200, 202, 208].includes(response.status)) return;
		if (attempt === 5) throw new Error(`upload-${response.status}-${transaction.id}`);
		await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
	}
}

function record(transaction, kind, collection) {
	return { id: transaction.id, kind, collection, reward: transaction.reward, bytes: transaction.data_size };
}

function totalCost() {
	return ledger.transactions.reduce(
		(total, transaction) => total + BigInt(transaction.reward) + BigInt(transaction.quantity ?? '0'),
		0n
	);
}

function assertBudget() {
	if (totalCost() > 50_000_000_000_000n) throw new Error('publication-budget-exceeded');
}

async function save() {
	assertBudget();
	await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}
