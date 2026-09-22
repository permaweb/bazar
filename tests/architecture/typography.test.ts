import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');

function presentationFiles(directory = sourceRoot): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return presentationFiles(path);
		if (!/\.(?:css|scss|ts|tsx)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) return [];
		return [path];
	});
}

function matches(pattern: RegExp, extensions?: RegExp): string[] {
	return presentationFiles().flatMap((path) => {
		if (extensions && !extensions.test(path)) return [];
		const source = readFileSync(path, 'utf8');
		const matcher = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
		return Array.from(source.matchAll(matcher), (match) => {
			const line = source.slice(0, match.index).split('\n').length;
			return `${relative(process.cwd(), path)}:${line}`;
		});
	});
}

describe('app typography casing', () => {
	it('does not force uppercase or small-caps through styles', () => {
		expect(
			matches(
				/text-transform\s*:\s*uppercase|textTransform\s*:\s*['"]uppercase|font-variant(?:-caps)?\s*:\s*(?:small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps)/i
			)
		).toEqual([]);
	});

	it('does not uppercase presentation values in components', () => {
		expect(matches(/\.to(?:Locale)?UpperCase\s*\(/, /\.tsx$/)).toEqual([]);
	});

	it('keeps authored multi-word interface copy out of all caps', () => {
		expect(matches(/>\s*[A-Z][A-Z0-9@./:+&-]*(?:\s+[A-Z0-9][A-Z0-9@./:+&-]*)+\s*</, /\.tsx$/)).toEqual([]);
		expect(matches(/['"][A-Z][A-Z0-9@./:+&-]*(?:\s+[A-Z0-9][A-Z0-9@./:+&-]*)+['"]/, /\.tsx$/)).toEqual([]);
	});
});
