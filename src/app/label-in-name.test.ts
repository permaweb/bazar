import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');

function componentFiles(directory = sourceRoot): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return componentFiles(path);
		if (!entry.name.endsWith('.tsx') || /\.test\.tsx$/.test(entry.name)) return [];
		return [path];
	});
}

type LabelledInput = { at: string; label: string; placeholder: string };

function literalLabelledInputs(): LabelledInput[] {
	return componentFiles().flatMap((path) => {
		const source = readFileSync(path, 'utf8');
		return Array.from(source.matchAll(/<input\b([\s\S]*?)\/>/g)).flatMap((match) => {
			const label = /\baria-label="([^"]*)"/.exec(match[1])?.[1];
			const placeholder = /\bplaceholder="([^"]*)"/.exec(match[1])?.[1];
			if (label === undefined || placeholder === undefined) return [];
			const line = source.slice(0, match.index).split('\n').length;
			return [{ at: `${relative(process.cwd(), path)}:${line}`, label, placeholder }];
		});
	});
}

describe('input label in name (WCAG 2.5.3)', () => {
	it('finds the header and panel search inputs', () => {
		const labels = literalLabelledInputs().map((input) => input.label);
		expect(labels).toContain('Search tokens, collections, and Uniques');
		expect(labels).toContain('Search Bazar marketplace');
	});

	it('keeps visible placeholder text inside the accessible name', () => {
		const mismatched = literalLabelledInputs()
			.filter((input) => !input.label.toLowerCase().includes(input.placeholder.toLowerCase()))
			.map((input) => `${input.at}: aria-label "${input.label}" vs placeholder "${input.placeholder}"`);
		expect(mismatched).toEqual([]);
	});
});
