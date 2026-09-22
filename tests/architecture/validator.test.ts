import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const validator = path.resolve(
	'.agents/skills/permaweb-frontend-code-style/scripts/validate_frontend_architecture.mjs'
);
const projects: string[] = [];

function validate(root: string) {
	return spawnSync(process.execPath, [validator, '--root', root], { encoding: 'utf8' });
}

function project(files: Record<string, string>) {
	const root = mkdtempSync(path.join(tmpdir(), 'bazar-architecture-'));
	projects.push(root);
	symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
	const configuration = {
		status: 'adopting',
		contractVersion: 1,
		externalSdkPackages: ['arweave', 'ao.js', 'weave-wrangler'],
		performanceBudgets: { directories: [{ path: 'dist', maxBytes: 1000 }] },
	};
	for (const [file, source] of Object.entries({
		'package.json': '{}',
		'.permaweb-frontend.json': JSON.stringify(configuration),
		'tsconfig.json': JSON.stringify({
			compilerOptions: { baseUrl: './src', paths: { '*': ['*'] }, jsx: 'react-jsx' },
			include: ['src'],
		}),
		...files,
	})) {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), source);
	}
	return validate(root);
}

afterEach(() => {
	for (const root of projects.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Bazar frontend architecture', () => {
	it('passes the bundled validator', () => {
		const result = validate(process.cwd());
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	});

	it('rejects raw controls, named React imports, and SDK imports outside their owners', () => {
		const result = project({
			'src/features/Market/index.ts': "export { Panel } from './components/molecules/Panel';",
			'src/features/Market/components/molecules/Panel/Panel.tsx':
				"import { useState } from 'react';\nimport Arweave from 'arweave';\nexport default function Panel() { const [open] = useState(Arweave); return <button>{String(open)}</button>; }",
			'src/features/Market/components/molecules/Panel/styles.ts': 'export {};',
			'src/features/Market/components/molecules/Panel/index.ts': "export { default as Panel } from './Panel';",
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('[native-control-ownership]');
		expect(result.stderr).toContain('[react-default-import]');
		expect(result.stderr).toContain('[api-boundary]');
	});

	it('rejects cross-feature deep imports and shell headers outside navigation', () => {
		const result = project({
			'src/features/A/index.ts': "export { value } from './model/value';",
			'src/features/A/model/value.ts': 'export const value = 1;',
			'src/features/B/index.ts': "export { total } from './model/total';",
			'src/features/B/model/total.ts':
				"import { value } from 'features/A/model/value';\nexport const total = value + 1;",
			'src/components/organisms/SiteHeader/SiteHeader.tsx':
				'export default function SiteHeader() { return null; }',
			'src/components/organisms/SiteHeader/styles.ts': 'export {};',
			'src/components/organisms/SiteHeader/index.ts': "export { default as SiteHeader } from './SiteHeader';",
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('[feature-public-api] src/features/B/model/total.ts');
		expect(result.stderr).toContain('[navigation-ownership]');
	});

	it('rejects shared components that depend on API adapters', () => {
		const result = project({
			'src/api/assets/index.ts':
				'export async function readAsset() { return fetch("https://arweave.net/info"); }',
			'src/components/molecules/AssetBadge/AssetBadge.tsx':
				"import { readAsset } from 'api/assets';\nexport default function AssetBadge() { void readAsset(); return null; }",
			'src/components/molecules/AssetBadge/styles.ts': 'export {};',
			'src/components/molecules/AssetBadge/index.ts': "export { default as AssetBadge } from './AssetBadge';",
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('[dependency-direction] src/components/molecules/AssetBadge/AssetBadge.tsx');
	});
});
