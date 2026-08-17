#!/usr/bin/env node
import * as arbundles from 'arbundles';
import fs from 'node:fs/promises';
import path from 'node:path';

import Arweave from 'arweave';

import {
	assertArweaveId,
	initialReferenceTags,
	nextReferenceTimestamp,
	setReferenceTags,
	tagsToObject,
} from './site-reference-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const deploymentLedgerPath = path.join(root, '.run-data', 'site-deployment.json');
const referenceLedgerPath = path.join(root, '.run-data', 'site-reference.json');
const bundlerUrl = 'https://bundler.mystical.computer/~bundler@1.0/tx';
const graphqlUrl = 'https://arweave.net/graphql';
const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
const [command, ...arguments_] = process.argv.slice(2);
const dryRun = arguments_.includes('--dry-run');
const targetArgument = arguments_.find((value) => !value.startsWith('--'));

if (!['init', 'set'].includes(command)) usage();

const configuredReferenceId = process.env.BAZAR_REFERENCE_ID?.trim();
const existing = await readJson(referenceLedgerPath, null);

const wallet = readDeployWallet(process.env.DEPLOY_KEY?.trim());
const authority = await arweave.wallets.jwkToAddress(wallet);
const deployment = await readJson(deploymentLedgerPath, null);
const target = assertArweaveId(targetArgument ?? deployment?.manifest?.id, 'reference-value');

if (deployment?.owner && deployment.owner !== authority) throw new Error('deployment-ledger-owner-mismatch');
if (existing?.authority && existing.authority !== authority) throw new Error('reference-ledger-owner-mismatch');

if (command === 'init') {
	if (configuredReferenceId || existing?.referenceId) throw new Error('stable-reference-already-configured');
	const timestamp = Date.now();
	const result = await signAndMaybePost(initialReferenceTags({ authority, target, timestamp }));
	const ledger = {
		device: 'reference@1.0',
		referenceId: result.id,
		authority,
		currentTarget: target,
		lastItemId: result.id,
		lastTimestamp: timestamp,
		updatedAt: new Date().toISOString(),
	};
	if (!dryRun) await saveJson(referenceLedgerPath, ledger);
	printResult('initialized', ledger, result);
	process.exit(0);
}

const referenceId = assertArweaveId(configuredReferenceId ?? existing?.referenceId, 'reference-id');
if (configuredReferenceId && existing?.referenceId && configuredReferenceId !== existing.referenceId) {
	throw new Error('configured-reference-does-not-match-local-ledger');
}

const definition = await readReferenceDefinition(referenceId);
if (definition && (definition.owner !== authority || definition.authority !== authority)) {
	throw new Error('reference-authority-does-not-match-deploy-key');
}
if (!definition && !existing?.referenceId) throw new Error('reference-definition-not-indexed');

const indexedTimestamp = await readLatestSetTimestamp(referenceId, authority);
const timestamp = nextReferenceTimestamp(Date.now(), existing?.lastTimestamp, indexedTimestamp);
const result = await signAndMaybePost(setReferenceTags({ referenceId, target, timestamp }));
const ledger = {
	device: 'reference@1.0',
	referenceId,
	authority,
	currentTarget: target,
	lastItemId: result.id,
	lastTimestamp: timestamp,
	updatedAt: new Date().toISOString(),
};
if (!dryRun) await saveJson(referenceLedgerPath, ledger);
printResult('updated', ledger, result);

async function signAndMaybePost(tags) {
	const signer = new arbundles.ArweaveSigner(wallet);
	const item = arbundles.createData(' ', signer, { tags });
	await item.sign(signer);
	if (dryRun) return { id: item.id, status: 'dry-run', tags: tagsToObject(tags), bytes: item.getRaw().byteLength };

	const response = await fetch(bundlerUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/octet-stream',
			'bundler-subject': 'body',
			accept: 'application/json',
		},
		body: item.getRaw(),
	});
	const responseId = response.headers.get('id');
	if (response.status !== 200 || responseId !== item.id) {
		throw new Error(
			`reference-post-failed status=${response.status} expected=${item.id} received=${responseId ?? 'missing'}`
		);
	}
	return { id: item.id, status: response.status, tags: tagsToObject(tags), bytes: item.getRaw().byteLength };
}

async function readReferenceDefinition(referenceId) {
	const edges = await graphql(
		`
			query ($ids: [ID!]) {
				transactions(ids: $ids, first: 1) {
					edges {
						node {
							id
							owner {
								address
							}
							tags {
								name
								value
							}
						}
					}
				}
			}
		`,
		{ ids: [referenceId] }
	);
	const node = edges[0]?.node;
	if (!node) return null;
	const tags = tagsToObject(node.tags);
	if (tags.device !== 'reference@1.0') throw new Error('configured-id-is-not-a-reference');
	return { owner: node.owner.address, authority: tags.authority };
}

async function readLatestSetTimestamp(referenceId, authority) {
	const edges = await graphql(
		`
			query ($owners: [String!], $tags: [TagFilter!]) {
				transactions(owners: $owners, tags: $tags, first: 100, sort: HEIGHT_DESC) {
					edges {
						node {
							tags {
								name
								value
							}
						}
					}
				}
			}
		`,
		{
			owners: [authority],
			tags: [{ name: 'reference-id', values: [referenceId] }],
		}
	);
	return edges.reduce((latest, { node }) => {
		const timestamp = Number(tagsToObject(node.tags).timestamp);
		return Number.isSafeInteger(timestamp) ? Math.max(latest, timestamp) : latest;
	}, 0);
}

async function graphql(query, variables) {
	const response = await fetch(graphqlUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) throw new Error(`reference-graphql-${response.status}`);
	const payload = await response.json();
	if (payload.errors?.length) throw new Error(`reference-graphql-error: ${payload.errors[0].message}`);
	return payload.data.transactions.edges;
}

function readDeployWallet(value) {
	if (!value) throw new Error('DEPLOY_KEY environment variable is not set');
	const parsed = JSON.parse(value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8'));
	if (!['n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'].every((field) => parsed[field])) {
		throw new Error('DEPLOY_KEY must contain a complete private RSA JWK for reference signing');
	}
	return parsed;
}

async function readJson(filename, fallback) {
	try {
		return JSON.parse(await fs.readFile(filename, 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') return fallback;
		throw error;
	}
}

async function saveJson(filename, value) {
	await fs.mkdir(path.dirname(filename), { recursive: true });
	await fs.writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function printResult(action, ledger, result) {
	console.log(
		JSON.stringify(
			{
				action,
				referenceId: ledger.referenceId,
				stableUrl: `https://arweave.net/${ledger.referenceId}`,
				target: ledger.currentTarget,
				setItemId: result.id,
				status: result.status,
				timestamp: ledger.lastTimestamp,
				bytes: result.bytes,
			},
			null,
			2
		)
	);
}

function usage() {
	throw new Error('usage: site-reference.mjs <init|set> [target-txid] [--dry-run]');
}
