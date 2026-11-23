import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ASSET_TRANSACTION_CONFIRMATION_TARGET } from './confirmation-target';

const sourceRoot = join(process.cwd(), 'src');
const read = (path: string) => readFileSync(join(sourceRoot, path), 'utf8');

/**
 * Every module that watches, seeds or labels a listing, cancel, transfer or mint
 * transaction against the asset depth.
 */
const ASSET_CONFIRMATION_CONSUMERS = [
	'app/App.tsx',
	'app/FungibleAssetView.tsx',
	'app/operation-activity.ts',
	'routes/CreateRoute.tsx',
];

/** Ways a confirmation depth can be written down as a bare literal instead of read from its constant. */
function literalDepthPatterns(depth: number): RegExp[] {
	return [
		// `target: 5`, `confirmationTarget: 5`, `registrationTarget: 5`
		new RegExp(`[Tt]arget\\s*:\\s*${depth}\\b`),
		// `step?.target ?? 5`, `stored.confirmationTarget || 5`
		new RegExp(`[Tt]arget\\b[^;\\n]*(?:\\?\\?|\\|\\|)\\s*${depth}\\b`),
		// `setConfirmations(5)`, `setMintConfirmations(5)`
		new RegExp(`\\bset\\w*Confirmations\\(\\s*${depth}\\s*\\)`),
		// `postConfirmationPendingLabel(confirmations, 5, message)` and the lifecycle helper's target argument
		new RegExp(`\\b(?:postConfirmationPendingLabel|confirmationLifecycleState)\\(\\s*[^,()]+,\\s*${depth}\\s*[,)]`),
	];
}

function lineMatches(path: string, pattern: RegExp): string[] {
	const source = read(path);
	const matcher = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
	return Array.from(source.matchAll(matcher), (match) => {
		const line = source.slice(0, match.index).split('\n').length;
		return `${path}:${line}: ${match[0]}`;
	});
}

describe('asset transaction confirmation target', () => {
	it('is five confirmations, defined in a dependency-free module the app shell can import eagerly', () => {
		expect(ASSET_TRANSACTION_CONFIRMATION_TARGET).toBe(5);
		expect(read('api/confirmation-target.ts')).not.toMatch(/^\s*import\b/m);
	});

	it('has a single definition', () => {
		expect(read('api/asset-transactions.ts')).not.toMatch(/ASSET_TRANSACTION_CONFIRMATION_TARGET\s*=/);
	});

	it.each([
		['target: 5', true],
		['confirmationTarget: 5,', true],
		['const confirmationTarget = activeSyncStep?.target ?? 5;', true],
		['confirmationTarget: Math.max(1, finiteNonNegative(value.confirmationTarget) || 5),', true],
		['setMintConfirmations(5);', true],
		['postConfirmationPendingLabel(confirmations, 5, message)', true],
		['postConfirmationPendingLabel(\n\tconfirmations,\n\t5,\n\tmessage\n)', true],
		['target: ASSET_TRANSACTION_CONFIRMATION_TARGET,', false],
		['activeSyncStep?.target ?? operationConfirmationTarget(operation)', false],
		['postConfirmationPendingLabel(activityConfirmations, confirmationTarget, workingStatus)', false],
		['const delay = Math.min(60_000, 5_000 * 2 ** Math.min(retry, 4)) || 5;', false],
	])('the literal-depth guard flags %j: %s', (source, flagged) => {
		const depth = ASSET_TRANSACTION_CONFIRMATION_TARGET;
		expect(literalDepthPatterns(depth).some((pattern) => pattern.test(source))).toBe(flagged);
	});

	it.each(ASSET_CONFIRMATION_CONSUMERS)('%s reads the depth from the constant', (path) => {
		const depth = ASSET_TRANSACTION_CONFIRMATION_TARGET;
		expect([
			...literalDepthPatterns(depth).flatMap((pattern) => lineMatches(path, pattern)),
			...lineMatches(path, /\b(?:one|two|three|four|five|six|seven|eight|nine|ten) confirmations reached\b/i),
		]).toEqual([]);
		expect(read(path)).toMatch(
			/import \{ ASSET_TRANSACTION_CONFIRMATION_TARGET \} from 'api\/confirmation-target';/
		);
	});

	it('keeps the eagerly loaded app shell off the lazy transaction runtime', () => {
		expect(lineMatches('app/App.tsx', /^import\s+(?!type\b)[^;]*from 'api\/asset-transactions';/m)).toEqual([]);
	});
});
