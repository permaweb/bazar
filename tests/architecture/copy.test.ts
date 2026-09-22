import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { findHardcodedCopy } from './copy-detection';

const sourceRoot = path.resolve('src');

// Adapters in `src/api` return data and AppError codes; on-chain tag values and GraphQL documents there are
// protocol data, not copy. Message catalogs and design tokens are the only other places that hold literal text.
const EXCLUDED = [
	/^src\/api\//,
	/(?:^|\/)messages\.ts$/,
	/(?:^|\/)styles\.ts$/,
	/\.d\.ts$/,
	/^src\/helpers\/theme\.ts$/,
];

// Temporary: areas whose copy has not moved into message catalogs yet. Delete each entry as its area migrates;
// the architecture migration is complete only when this list is empty.
const PENDING_COPY_MIGRATION = [
	'src/apps/',

	'src/components/',

	'src/helpers/',

	'src/navigation/',

	'src/providers/',

	'src/views/',

	'src/features/Activity/',

	'src/features/AssetDetail/',

	'src/features/Catalogue/',

	'src/features/Collection/',

	'src/features/Create/',

	'src/features/Dispatch/',

	'src/features/Home/',

	'src/features/MyAssets/',

	'src/features/Operations/',

	'src/features/Profile/',

	'src/features/TransactionSync/',
];

function sourceFiles(directory = sourceRoot): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
	});
}

describe('user-facing copy', () => {
	it('keeps user-facing strings in message catalogs', () => {
		const offenders = sourceFiles().flatMap((file) => {
			const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
			if (EXCLUDED.some((pattern) => pattern.test(relative))) return [];
			if (PENDING_COPY_MIGRATION.some((prefix) => relative.startsWith(prefix))) return [];
			return findHardcodedCopy(relative, readFileSync(file, 'utf8')).map(
				(finding) => `${relative}:${finding.line} ${finding.text}`
			);
		});
		expect(offenders).toEqual([]);
	});

	it('detects prose in JSX, copy attributes, and copy-bearing literals', () => {
		const findings = findHardcodedCopy(
			'Fixture.tsx',
			`export function Fixture(props: { busy: boolean }) {
				const label = props.busy ? 'Saving…' : 'Save changes';
				return (
					<section aria-label="Edit profile">
						<h2>Profile</h2>
						<Button label={label} title={props.busy ? 'Please wait' : undefined} />
						{props.busy && 'Working on it'}
					</section>
				);
			}`
		).map((finding) => finding.text);
		expect(findings).toEqual([
			'Saving…',
			'Save changes',
			'Edit profile',
			'Profile',
			'Please wait',
			'Working on it',
		]);
	});

	it('ignores machine values, class names, comparisons, keys, and diagnostics', () => {
		expect(
			findHardcodedCopy(
				'Fixture.tsx',
				`import { Icon } from 'components/atoms/Icon';
				type Tone = 'Needs review';
				export function Fixture(props: { state: string; event: KeyboardEvent }) {
					if (props.event.key === 'Escape') throw new Error('Unexpected dialog state');
					console.warn('Falling back to cached data');
					const className = \`asset-card asset-card--\${props.state}\`;
					const labels = { 'Content-Type': 'application/json' };
					return (
						<div className={className} data-state="Ready now" id="asset-title" role="status">
							{props.state === 'Listed for sale' ? <Icon icon="check" /> : null}
							{labels['Content-Type']}
						</div>
					);
				}`
			)
		).toEqual([]);
	});
});
