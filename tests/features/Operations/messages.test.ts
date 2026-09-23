import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { OPERATIONS_MESSAGES, type OperationsMessages } from 'features/Operations/messages';
import { LANGUAGES, resolveMessages } from 'helpers/i18n';

const FEATURE_ROOT = path.resolve('src/features/Operations');
const CATALOG_KEYS = Object.keys(OPERATIONS_MESSAGES.en) as Array<keyof OperationsMessages>;
const PLACEHOLDER = /\{(\w+)\}/g;

function featureFiles(directory = FEATURE_ROOT): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return featureFiles(entryPath);
		return /\.tsx?$/.test(entry.name) && entry.name !== 'messages.ts' ? [entryPath] : [];
	});
}

function parse(file: string) {
	return ts.createSourceFile(
		file,
		readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);
}

function placeholdersOf(template: string): string[] {
	return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();
}

/** Every catalog key the feature reads, whether through `messages.key` or a key map of message names. */
function referencedKeys(): Set<string> {
	const keys = new Set<string>();
	const catalog = new Set<string>(CATALOG_KEYS);
	for (const file of featureFiles()) {
		const source = parse(file);
		const visit = (node: ts.Node) => {
			if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'messages') {
				keys.add(node.name.text);
			}
			if (ts.isStringLiteral(node) && catalog.has(node.text)) keys.add(node.text);
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return keys;
}

/** Message keys read inside one expression, so a `condition ? messages.a : messages.b` argument is covered. */
function keysIn(node: ts.Node, source: ts.SourceFile): string[] {
	const keys: string[] = [];
	const visit = (current: ts.Node) => {
		if (ts.isPropertyAccessExpression(current) && current.expression.getText(source) === 'messages') {
			keys.push(current.name.text);
		}
		ts.forEachChild(current, visit);
	};
	visit(node);
	return keys;
}

/**
 * Every place the feature fills a message's placeholders: `formatMessage(messages.key, { … })`, and
 * `messagePartsAround(messages.key, 'name')` where a component renders an element in the placeholder's place.
 */
function placeholderUses(): Array<{ file: string; key: string; values: string[] }> {
	const uses: Array<{ file: string; key: string; values: string[] }> = [];
	for (const file of featureFiles()) {
		const source = parse(file);
		const relative = path.relative(process.cwd(), file);
		const visit = (node: ts.Node) => {
			if (ts.isCallExpression(node) && node.arguments.length === 2) {
				const callee = node.expression.getText(source);
				const [subject, filled] = node.arguments;
				if (callee === 'formatMessage' && ts.isObjectLiteralExpression(filled)) {
					const values = filled.properties
						.map((property) => property.name?.getText(source).replace(/['"]/g, '') ?? '')
						.filter(Boolean)
						.sort();
					for (const key of keysIn(subject, source)) uses.push({ file: relative, key, values });
				}
				if (callee === 'messagePartsAround' && ts.isStringLiteral(filled)) {
					for (const key of keysIn(subject, source)) {
						uses.push({ file: relative, key, values: [filled.text] });
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return uses;
}

describe('operations message catalog', () => {
	it('resolves every key for every supported language', () => {
		for (const language of LANGUAGES) {
			const resolved = resolveMessages(OPERATIONS_MESSAGES, language);
			for (const key of CATALOG_KEYS) {
				expect(typeof resolved[key], `${language}.${key}`).toBe('string');
				expect(resolved[key], `${language}.${key}`).not.toBe('');
			}
		}
	});

	it('defines every key the feature reads, and reads every key it defines', () => {
		const referenced = referencedKeys();
		const catalog = new Set<string>(CATALOG_KEYS);
		const missing = [...referenced].filter((key) => !catalog.has(key)).sort();
		const unused = CATALOG_KEYS.filter((key) => !referenced.has(key)).sort();

		expect({ missing, unused }).toEqual({ missing: [], unused: [] });
	});

	it('passes exactly the placeholders each interpolated message declares', () => {
		for (const use of placeholderUses()) {
			expect(CATALOG_KEYS, `${use.file} interpolates an unknown key ${use.key}`).toContain(use.key);
			expect(use.values, `${use.file} interpolates ${use.key}`).toEqual(
				placeholdersOf(OPERATIONS_MESSAGES.en[use.key as keyof OperationsMessages])
			);
		}
	});

	it('fills the placeholders of every message that declares one', () => {
		const uses = placeholderUses();
		const unfilled = CATALOG_KEYS.filter(
			(key) => placeholdersOf(OPERATIONS_MESSAGES.en[key]).length && !uses.some((use) => use.key === key)
		);

		expect(unfilled).toEqual([]);
	});
});
