import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { LanguageProvider, useLanguageProvider } from 'providers/LanguageProvider';

// The component reads copy through an untyped `language` object, so the
// compiler cannot catch a missing key. This test is that guard.
const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8');

function providedStrings(): Record<string, string> {
	let captured: Record<string, string> = {};
	function Probe() {
		captured = useLanguageProvider().strings;
		return null;
	}
	renderToStaticMarkup(
		<LanguageProvider>
			<Probe />
		</LanguageProvider>
	);
	return captured;
}

function readKeys(): string[] {
	const keys = new Set<string>();
	for (const match of source.matchAll(/\blanguage\.([A-Za-z0-9_]+)/g)) keys.add(match[1]);
	for (const match of source.matchAll(/['"`](transactionSync[A-Za-z0-9_]*)['"`]/g)) keys.add(match[1]);
	return [...keys].sort();
}

describe('ArweaveTransactionSync language keys', () => {
	it('reads copy by static key only, so every key read is visible to this check', () => {
		expect(source).not.toMatch(/\blanguage\s*\[/);
	});

	it('reads only keys the language provider defines', () => {
		const strings = providedStrings();
		const keys = readKeys();
		expect(keys.length).toBeGreaterThan(0);
		expect(keys.filter((key) => !(key in strings))).toEqual([]);
	});
});
