import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve('src');

// Presentation layers compose UI. Data loading, protocol calls, and state machines live in hooks, providers, and
// models, so these layers may import API contracts only as types.
const PRESENTATION = [
	/^src\/components\//,
	/^src\/features\/[^/]+\/components\//,
	/^src\/navigation\//,
	/^src\/views\//,
];

// Temporary: components whose orchestration has not moved into hooks yet. Delete each entry as it migrates; the
// architecture migration is complete only when this list is empty.
const PENDING_ORCHESTRATION_MIGRATION = [
	'src/features/Activity/components/',

	'src/features/AssetDetail/components/molecules/FungiblePurchaseComposer/',

	'src/features/AssetDetail/components/molecules/SetProfilePictureButton/',

	'src/features/AssetDetail/components/organisms/AssetDetail/',

	'src/features/AssetDetail/components/organisms/AssetDetailLoadingShell/',

	'src/features/AssetDetail/components/organisms/AudioWaveformPlayer/',

	'src/features/AssetDetail/components/organisms/FungibleAssetView/',

	'src/features/AssetDetail/components/organisms/FungibleOperationDialog/',

	'src/features/AssetDetail/components/organisms/PendingAssetDetail/',

	'src/features/Catalogue/components/',

	'src/features/Collection/components/',

	'src/features/Create/components/',

	'src/features/Dispatch/components/',

	'src/features/Home/components/',

	'src/features/MyAssets/components/',

	'src/features/Operations/components/',

	'src/features/Profile/components/',

	'src/features/TransactionSync/components/',

	'src/navigation/',
];

export function runtimeApiImports(fileName: string, sourceText: string): string[] {
	const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	const offenders: string[] = [];
	const visit = (node: ts.Node) => {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const specifier = node.moduleSpecifier.text;
			const clause = node.importClause;
			const typeOnly =
				clause?.isTypeOnly ||
				(clause &&
					!clause.name &&
					clause.namedBindings &&
					ts.isNamedImports(clause.namedBindings) &&
					clause.namedBindings.elements.every((element) => element.isTypeOnly));
			if (/^(?:@\/)?api(?:\/|$)/.test(specifier) && !typeOnly) offenders.push(specifier);
		}
		if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments[0] &&
			ts.isStringLiteral(node.arguments[0]) &&
			/^(?:@\/)?api(?:\/|$)/.test(node.arguments[0].text)
		) {
			offenders.push(`import(${node.arguments[0].text})`);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return offenders;
}

function sourceFiles(directory = sourceRoot): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
	});
}

describe('presentation boundaries', () => {
	it('keeps runtime API access out of presentation layers', () => {
		const offenders = sourceFiles().flatMap((file) => {
			const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
			if (!PRESENTATION.some((pattern) => pattern.test(relative))) return [];
			if (PENDING_ORCHESTRATION_MIGRATION.some((prefix) => relative.startsWith(prefix))) return [];
			return runtimeApiImports(relative, readFileSync(file, 'utf8')).map(
				(specifier) => `${relative} ${specifier}`
			);
		});
		expect(offenders).toEqual([]);
	});

	it('distinguishes type-only imports from runtime imports', () => {
		expect(
			runtimeApiImports(
				'Fixture.tsx',
				`import type { Asset } from 'api/marketplace';
				import { type Order, type Listing } from 'api/marketplace';
				import { readAsset } from 'api/marketplace';
				import { type Quote, quote } from 'api/dispatch';
				const lazy = () => import('api/mint');`
			)
		).toEqual(['api/marketplace', 'api/dispatch', 'import(api/mint)']);
	});
});
