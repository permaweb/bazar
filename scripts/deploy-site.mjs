#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import Arweave from 'arweave';

const root = path.resolve(import.meta.dirname, '..');
const distRoot = path.join(root, 'dist');
const ledgerPath = path.join(root, '.run-data', 'site-deployment.json');
const budget = 5_000_000_000_000n;
const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
const deployKey = process.env.DEPLOY_KEY?.trim();

if (!deployKey) throw new Error('DEPLOY_KEY environment variable is not set');

const wallet = completePrivateJwk(
	JSON.parse(deployKey.startsWith('{') ? deployKey : Buffer.from(deployKey, 'base64').toString('utf8'))
);
const owner = await arweave.wallets.jwkToAddress(wallet);
// Keep source maps in normal builds for downstream debugging without paying to
// include those non-runtime artifacts in the immutable site deployment.
const files = (await listFiles(distRoot)).filter((filename) => !filename.endsWith('.map'));
const ledger = await readLedger(owner);

for (const filename of files) {
	const bytes = await fs.readFile(path.join(distRoot, filename));
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	const prior = ledger.files[filename];
	if (prior?.sha256 === sha256 && prior.status === 'posted') {
		console.log(`Reusing ${filename}: ${prior.id}`);
		continue;
	}

	const transaction = await arweave.createTransaction({ data: bytes }, wallet);
	addTags(transaction, {
		'Content-Type': contentType(filename),
		'App-Name': 'Bazar',
		'App-Version': '2.0.0',
		Type: 'Website-Asset',
		'File-Path': filename,
	});
	assertBudget(ledger, transaction.reward);
	await signAndPost(transaction);
	ledger.files[filename] = {
		id: transaction.id,
		reward: transaction.reward,
		sha256,
		status: 'posted',
	};
	await saveLedger(ledger);
	console.log(`Uploaded ${filename}: ${transaction.id}`);
}

const paths = Object.fromEntries(files.map((filename) => [filename, { id: ledger.files[filename].id }]));
const manifestBytes = Buffer.from(
	JSON.stringify({
		manifest: 'arweave/paths',
		version: '0.2.0',
		index: { path: 'index.html' },
		paths,
	})
);
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');

if (ledger.manifest?.sha256 !== manifestSha256 || ledger.manifest.status !== 'posted') {
	const transaction = await arweave.createTransaction({ data: manifestBytes }, wallet);
	addTags(transaction, {
		'Content-Type': 'application/x.arweave-manifest+json',
		'App-Name': 'Bazar',
		'App-Version': '2.0.0',
		Type: 'Website-Manifest',
	});
	assertBudget(ledger, transaction.reward);
	await signAndPost(transaction);
	ledger.manifest = {
		id: transaction.id,
		reward: transaction.reward,
		sha256: manifestSha256,
		status: 'posted',
	};
	await saveLedger(ledger);
}

console.log(`Bazar manifest ID: ${ledger.manifest.id}`);
console.log(`Arweave URL: https://arweave.net/${ledger.manifest.id}`);

async function listFiles(directory, relative = '') {
	const entries = await fs.readdir(path.join(directory, relative), { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const filename = path.posix.join(relative, entry.name);
			return entry.isDirectory() ? listFiles(directory, filename) : [filename];
		})
	);
	return nested.flat().sort();
}

function addTags(transaction, tags) {
	for (const [name, value] of Object.entries(tags)) transaction.addTag(name, value);
}

async function signAndPost(transaction) {
	await arweave.transactions.sign(transaction, wallet);
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		const response = await arweave.transactions.post(transaction);
		if ([200, 202, 208].includes(response.status)) return;
		if (attempt === 5) throw new Error(`upload-${response.status}-${transaction.id}`);
		await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
	}
}

function assertBudget(currentLedger, nextReward) {
	const committed = [...Object.values(currentLedger.files), currentLedger.manifest]
		.filter((entry) => entry?.status === 'posted')
		.reduce((total, entry) => total + BigInt(entry.reward), 0n);
	if (committed + BigInt(nextReward) > budget) {
		throw new Error('site-deployment-budget-exceeded');
	}
}

async function readLedger(expectedOwner) {
	try {
		const parsed = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
		if (parsed.owner !== expectedOwner) throw new Error('deployment-ledger-owner-mismatch');
		return parsed;
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		return { owner: expectedOwner, files: {}, manifest: null };
	}
}

async function saveLedger(value) {
	await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
	await fs.writeFile(ledgerPath, `${JSON.stringify(value, null, 2)}\n`);
}

function contentType(filename) {
	const extension = path.extname(filename).toLowerCase();
	return (
		{
			'.css': 'text/css; charset=utf-8',
			'.html': 'text/html; charset=utf-8',
			'.js': 'text/javascript; charset=utf-8',
			'.json': 'application/json',
			'.map': 'application/json',
			'.svg': 'image/svg+xml',
			'.woff2': 'font/woff2',
		}[extension] ?? 'application/octet-stream'
	);
}

function completePrivateJwk(jwk) {
	if (['p', 'q', 'dp', 'dq', 'qi'].every((field) => jwk[field])) return jwk;
	if (!['n', 'e', 'd'].every((field) => jwk[field])) {
		throw new Error('DEPLOY_KEY is not a private RSA JWK');
	}

	const n = decodeInteger(jwk.n);
	const e = decodeInteger(jwk.e);
	const d = decodeInteger(jwk.d);
	const { p, q } = recoverPrimeFactors(n, e, d);
	return {
		...jwk,
		p: encodeInteger(p),
		q: encodeInteger(q),
		dp: encodeInteger(d % (p - 1n)),
		dq: encodeInteger(d % (q - 1n)),
		qi: encodeInteger(modInverse(q, p)),
	};
}

function recoverPrimeFactors(n, e, d) {
	let odd = d * e - 1n;
	let powersOfTwo = 0;
	while (odd % 2n === 0n) {
		odd /= 2n;
		powersOfTwo += 1;
	}

	for (let base = 2n; base < 128n; base += 1n) {
		let value = modPow(base, odd, n);
		if (value === 1n || value === n - 1n) continue;
		for (let exponent = 1; exponent <= powersOfTwo; exponent += 1) {
			const squared = (value * value) % n;
			if (squared === 1n) {
				const factor = greatestCommonDivisor(value - 1n, n);
				if (factor > 1n && factor < n) return { p: factor, q: n / factor };
				break;
			}
			if (squared === n - 1n) break;
			value = squared;
		}
	}
	throw new Error('Could not complete the private RSA JWK');
}

function modPow(base, exponent, modulus) {
	let result = 1n;
	let factor = base % modulus;
	let remaining = exponent;
	while (remaining > 0n) {
		if (remaining % 2n === 1n) result = (result * factor) % modulus;
		factor = (factor * factor) % modulus;
		remaining /= 2n;
	}
	return result;
}

function greatestCommonDivisor(left, right) {
	let a = left < 0n ? -left : left;
	let b = right < 0n ? -right : right;
	while (b !== 0n) [a, b] = [b, a % b];
	return a;
}

function modInverse(value, modulus) {
	let [oldRemainder, remainder] = [value, modulus];
	let [oldCoefficient, coefficient] = [1n, 0n];
	while (remainder !== 0n) {
		const quotient = oldRemainder / remainder;
		[oldRemainder, remainder] = [remainder, oldRemainder - quotient * remainder];
		[oldCoefficient, coefficient] = [coefficient, oldCoefficient - quotient * coefficient];
	}
	return ((oldCoefficient % modulus) + modulus) % modulus;
}

function decodeInteger(value) {
	const bytes = Buffer.from(value, 'base64url');
	return BigInt(`0x${bytes.toString('hex')}`);
}

function encodeInteger(value) {
	let hex = value.toString(16);
	if (hex.length % 2) hex = `0${hex}`;
	return Buffer.from(hex, 'hex').toString('base64url');
}
