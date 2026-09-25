import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { type LicenseDefaultCode, type LicenseFieldKey, type LicenseProperty } from 'api/marketplace';

import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';
import { licenseDisplayProperties } from 'features/AssetDetail/model/license-display';
import type { Message } from 'helpers/i18n';

const FEATURE_ROOT = path.resolve('src/features/AssetDetail');
const CATALOG = ASSET_DETAIL_MESSAGES.en;
const CATALOG_KEYS = new Set(Object.keys(CATALOG));
const PLACEHOLDER = /\{(\w+)\}/g;

function featureFiles(directory: string = FEATURE_ROOT): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return featureFiles(entryPath);
		return /\.tsx?$/.test(entry.name) && entry.name !== 'messages.ts' ? [entryPath] : [];
	});
}

function sourceFile(file: string): ts.SourceFile {
	return ts.createSourceFile(
		file,
		readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);
}

/** Every catalog key the feature reads, through `messages.key` or a `keyof AssetDetailMessages` literal. */
function referencedKeys(): Set<string> {
	const referenced = new Set<string>();
	for (const file of featureFiles()) {
		const source = sourceFile(file);
		const visit = (node: ts.Node) => {
			if (ts.isPropertyAccessExpression(node) && /(?:^|\.)messages$/.test(node.expression.getText(source))) {
				referenced.add(node.name.text);
			}
			if (ts.isStringLiteral(node) && CATALOG_KEYS.has(node.text)) referenced.add(node.text);
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return referenced;
}

function placeholdersOf(message: Message): Set<string> {
	const templates = typeof message === 'string' ? [message] : Object.values(message);
	const names = new Set<string>();
	for (const template of templates) {
		for (const match of (template ?? '').matchAll(PLACEHOLDER)) names.add(match[1]);
	}
	return names;
}

type InterpolationCall = { file: string; line: number; key: string; kind: 'format' | 'plural'; values: Set<string> };

/** Every `formatMessage(messages.key, { … })` and `plural(messages.key, count, { … })` the feature makes. */
function interpolationCalls(): InterpolationCall[] {
	const calls: InterpolationCall[] = [];
	for (const file of featureFiles()) {
		const source = sourceFile(file);
		const visit = (node: ts.Node) => {
			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
				const kind =
					node.expression.text === 'formatMessage'
						? ('format' as const)
						: node.expression.text === 'plural'
						? ('plural' as const)
						: null;
				const target = node.arguments[0];
				// A message chosen with a conditional still resolves to a catalog key on both branches.
				const branches = !target
					? []
					: ts.isConditionalExpression(target)
					? [target.whenTrue, target.whenFalse]
					: [target];
				const targetKeys = branches.flatMap((branch) =>
					ts.isPropertyAccessExpression(branch) && CATALOG_KEYS.has(branch.name.text)
						? [branch.name.text]
						: []
				);
				if (kind && targetKeys.length && targetKeys.length === branches.length) {
					const argument = node.arguments[kind === 'format' ? 1 : 2];
					const values = new Set<string>();
					if (argument && ts.isObjectLiteralExpression(argument)) {
						for (const property of argument.properties) {
							if (property.name) values.add(property.name.getText(source).replace(/['"]/g, ''));
						}
					}
					for (const key of targetKeys) {
						calls.push({
							file: path.relative(process.cwd(), file),
							line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
							key,
							kind,
							values,
						});
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return calls;
}

describe('asset detail message catalog', () => {
	it('resolves every message key the feature reads', () => {
		const missing = [...referencedKeys()].filter((key) => !CATALOG_KEYS.has(key));
		expect(missing).toEqual([]);
	});

	it('keeps no unused entries in the catalog', () => {
		const referenced = referencedKeys();
		expect([...CATALOG_KEYS].filter((key) => !referenced.has(key))).toEqual([]);
	});

	it('passes exactly the placeholders each template declares', () => {
		const calls = interpolationCalls();
		expect(calls.length).toBeGreaterThan(40);
		const mismatched = calls.flatMap((call) => {
			const declared = placeholdersOf(CATALOG[call.key as keyof typeof CATALOG]);
			// `formatPlural` supplies `count` itself, so a plural template may declare it without the caller passing it.
			const expected =
				call.kind === 'plural' ? new Set([...declared].filter((name) => name !== 'count')) : declared;
			const missing = [...expected].filter((name) => !call.values.has(name));
			const extra = [...call.values].filter((name) => !declared.has(name));
			return missing.length || extra.length
				? [`${call.file}:${call.line} ${call.key} missing=[${missing}] extra=[${extra}]`]
				: [];
		});
		expect(mismatched).toEqual([]);
	});

	it('has no blank message', () => {
		const blank = Object.entries(CATALOG).filter(([, message]) =>
			typeof message === 'string' ? !message.trim() : Object.values(message).some((value) => !value?.trim())
		);
		expect(blank.map(([key]) => key)).toEqual([]);
	});
});

describe('UDL licence display', () => {
	const FIELD_KEYS: LicenseFieldKey[] = [
		'license',
		'access',
		'access-fee',
		'derivation',
		'derivation-fee',
		'unknown-usage-rights',
		'commercial-use',
		'commercial-use-fee',
		'data-model-training',
		'expiry',
		'payment-mode',
		'payment-address',
		'currency',
	];
	const DEFAULT_CODES: LicenseDefaultCode[] = [
		'access-free',
		'derivation-non-commercial',
		'unknown-usage-rights-included',
		'commercial-use-not-allowed',
		'data-model-training-not-allowed',
		'expiry-unlimited',
		'currency-u',
	];

	it('names every adapter field key', () => {
		const rows = licenseDisplayProperties(
			FIELD_KEYS.map((key) => ({ key, value: { kind: 'declared', text: 'x' } } satisfies LicenseProperty)),
			CATALOG
		);
		expect(rows.map((row) => row.label)).toEqual([
			'License',
			'Access',
			'Access fee',
			'Derivatives',
			'Derivative fee',
			'Unknown usage rights',
			'Commercial use',
			'Commercial fee',
			'AI model training',
			'License term',
			'Payment mode',
			'Payment address',
			'Currency',
		]);
		expect(rows.every((row) => row.value === 'x')).toBe(true);
	});

	it('renders the effective UDL 0.2 defaults and the licence name', () => {
		const rows = licenseDisplayProperties(
			DEFAULT_CODES.map(
				(code) => ({ key: 'expiry', value: { kind: 'default', code } } satisfies LicenseProperty)
			),
			CATALOG
		);
		expect(rows.map((row) => row.value)).toEqual([
			'Free',
			'Non-commercial only',
			'Included where available',
			'Not allowed',
			'Not allowed',
			'Unlimited',
			'$U',
		]);
		expect(licenseDisplayProperties([{ key: 'license', value: { kind: 'udl-license' } }], CATALOG)).toEqual([
			{ key: 'license', label: 'License', value: 'Universal Data License 0.2' },
		]);
	});
});
