import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { COLLECTION_MESSAGES } from 'features/Collection/messages';
import { type Message, resolveMessages } from 'helpers/i18n';

const featureRoot = path.resolve('src/features/Collection');
const messages: Readonly<Record<string, Message>> = resolveMessages(COLLECTION_MESSAGES, 'en');
const catalogKeys = Object.keys(messages);

// The identifiers the feature binds its resolved catalog to: `useMessages(...)` results and `model/` parameters.
const CATALOG_BINDINGS = /^(?:language|messages)$/;
const PLACEHOLDER = /\{(\w+)\}/g;

type MessageUse = { key: string; file: string };
type FormatUse = { keys: string[]; values: string[]; implicitCount: boolean; file: string };

function sourceFiles(directory = featureRoot): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return /\.tsx?$/.test(entry.name) && entry.name !== 'messages.ts' ? [entryPath] : [];
	});
}

function templatesOf(message: Message): string[] {
	if (typeof message === 'string') return [message];
	return Object.values(message).filter((template): template is string => typeof template === 'string');
}

function placeholdersOf(message: Message): string[] {
	const templates = templatesOf(message);
	const names = new Set<string>();
	for (const template of templates) {
		for (const match of template.matchAll(PLACEHOLDER)) names.add(match[1]);
	}
	return [...names].sort();
}

function catalogKeysOf(node: ts.Node): string[] {
	const keys: string[] = [];
	const visit = (current: ts.Node) => {
		if (
			ts.isPropertyAccessExpression(current) &&
			ts.isIdentifier(current.expression) &&
			CATALOG_BINDINGS.test(current.expression.text)
		) {
			keys.push(current.name.text);
			return;
		}
		ts.forEachChild(current, visit);
	};
	visit(node);
	return keys;
}

const messageUses: MessageUse[] = [];
const formatUses: FormatUse[] = [];

for (const file of sourceFiles()) {
	const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
	const source = ts.createSourceFile(
		relative,
		readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);
	const visit = (node: ts.Node) => {
		if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
			if (CATALOG_BINDINGS.test(node.expression.text)) messageUses.push({ key: node.name.text, file: relative });
		}
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const callee = node.expression.text;
			const implicitCount = callee === 'plural';
			if (callee === 'formatMessage' || implicitCount) {
				const keys = catalogKeysOf(node.arguments[0]);
				const valuesArgument = node.arguments[implicitCount ? 2 : 1];
				const values =
					valuesArgument && ts.isObjectLiteralExpression(valuesArgument)
						? valuesArgument.properties.flatMap((property) =>
								property.name ? [property.name.getText(source).replace(/['"]/g, '')] : []
						  )
						: [];
				if (keys.length) formatUses.push({ keys, values, implicitCount, file: relative });
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
}

describe('collection message catalog', () => {
	it('is read by the feature and resolves every key the feature uses', () => {
		expect(messageUses.length).toBeGreaterThan(0);
		const unknown = messageUses.filter((use) => !Object.prototype.hasOwnProperty.call(messages, use.key));
		expect(unknown.map((use) => `${use.file}: ${use.key}`)).toEqual([]);
	});

	it('defines no message the feature never renders', () => {
		const used = new Set(messageUses.map((use) => use.key));
		expect(catalogKeys.filter((key) => !used.has(key))).toEqual([]);
	});

	it('passes every placeholder each interpolated message declares', () => {
		expect(formatUses.length).toBeGreaterThan(0);
		const mismatches = formatUses.flatMap((use) => {
			const provided = new Set(use.implicitCount ? [...use.values, 'count'] : use.values);
			return use.keys.flatMap((key) => {
				const missing = placeholdersOf(messages[key]).filter((name) => !provided.has(name));
				return missing.length ? [`${use.file}: ${key} missing ${missing.join(', ')}`] : [];
			});
		});
		expect(mismatches).toEqual([]);
	});

	it('passes no value that no interpolated message names', () => {
		const unused = formatUses.flatMap((use) => {
			const declared = new Set(use.keys.flatMap((key) => placeholdersOf(messages[key])));
			const extra = use.values.filter((name) => !declared.has(name));
			return extra.length ? [`${use.file}: ${use.keys.join('/')} passes unused ${extra.join(', ')}`] : [];
		});
		expect(unused).toEqual([]);
	});

	it('keeps every message non-empty and free of unresolved placeholders in its own text', () => {
		for (const key of catalogKeys) {
			for (const template of templatesOf(messages[key])) {
				expect(template.trim().length, key).toBeGreaterThan(0);
				expect(template, key).not.toMatch(/\{\s*\}/);
			}
		}
	});
});
