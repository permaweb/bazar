import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Every modal and side panel renders through the Dialog organism, which alone owns dialog semantics and focus.
const SHELL_DIRECTORY = 'src/components/organisms/Dialog/';

const DIALOG_SEMANTICS = [
	{ name: 'role="dialog"', pattern: /\brole\s*=\s*["'](?:alert)?dialog["']/ },
	{ name: 'role={... "dialog" ...}', pattern: /\brole\s*=\s*\{[^}]*["'`](?:alert)?dialog["'`][^}]*\}/ },
	{ name: "role: 'dialog'", pattern: /\brole\s*:\s*["'`](?:alert)?dialog["'`]/ },
	{ name: "setAttribute('role', 'dialog')", pattern: /setAttribute\(\s*["']role["']\s*,\s*["'](?:alert)?dialog["']/ },
	{ name: 'aria-modal', pattern: /\baria-modal\b/ },
	{ name: 'useDialogFocus', pattern: /\buseDialogFocus\b/ },
	{ name: '<dialog>', pattern: /<dialog[\s>]/ },
];

function dialogShellViolations(files: Array<{ path: string; source: string }>) {
	return files.flatMap((file) =>
		file.path.startsWith(SHELL_DIRECTORY)
			? []
			: DIALOG_SEMANTICS.filter((rule) => rule.pattern.test(file.source)).map(
					(rule) => `${file.path}: ${rule.name}`
			  )
	);
}

function sourceFiles(directory = 'src'): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.posix.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return /\.(?:jsx?|tsx?)$/.test(entry.name) ? [entryPath] : [];
	});
}

describe('dialog shell ownership', () => {
	it('keeps dialog roles, aria-modal, and dialog focus handling inside the Dialog organism', () => {
		const files = sourceFiles().map((file) => ({ path: file, source: readFileSync(file, 'utf8') }));
		expect(files.some((file) => file.path === `${SHELL_DIRECTORY}Dialog.tsx`)).toBe(true);
		expect(dialogShellViolations(files)).toEqual([]);
	});

	it('detects dialog semantics that bypass the shell', () => {
		expect(
			dialogShellViolations([
				{
					path: 'src/features/Market/components/organisms/Panel/Panel.tsx',
					source: '<div aria-modal="true" role="dialog" tabIndex={-1} />',
				},
				{
					path: 'src/features/Market/components/organisms/Drawer/Drawer.tsx',
					source: "<div role={props.visible ? 'dialog' : undefined} />",
				},
				{
					path: 'src/navigation/Menu/Menu.tsx',
					source: "import { useDialogFocus } from 'hooks/useDialogFocus';",
				},
				{
					path: 'src/navigation/Search/Search.tsx',
					source: 'document.querySelector(\'[role="dialog"][aria-modal="true"]\');',
				},
				{
					path: 'src/features/Market/components/organisms/Sheet/Sheet.tsx',
					source: "React.createElement('div', { role: 'alertdialog' });",
				},
				{ path: 'src/features/Market/components/organisms/Native/Native.tsx', source: '<dialog open />' },
				{
					path: 'src/features/Market/components/molecules/Status/Status.tsx',
					source: '<div role="status" className="dialog dialog-compact" data-kind="dialog" />',
				},
				{
					path: 'src/components/organisms/Dialog/Dialog.tsx',
					source: '<div aria-modal="true" role="dialog" />',
				},
			])
		).toEqual([
			'src/features/Market/components/organisms/Panel/Panel.tsx: role="dialog"',
			'src/features/Market/components/organisms/Panel/Panel.tsx: aria-modal',
			'src/features/Market/components/organisms/Drawer/Drawer.tsx: role={... "dialog" ...}',
			'src/navigation/Menu/Menu.tsx: useDialogFocus',
			'src/navigation/Search/Search.tsx: role="dialog"',
			'src/navigation/Search/Search.tsx: aria-modal',
			"src/features/Market/components/organisms/Sheet/Sheet.tsx: role: 'dialog'",
			'src/features/Market/components/organisms/Native/Native.tsx: <dialog>',
		]);
	});
});
