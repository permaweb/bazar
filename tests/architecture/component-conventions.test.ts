import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve('src');

function sourceFiles(directory = sourceRoot): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return entry.name.endsWith('.tsx') ? [entryPath] : [];
	});
}

function componentName(node: ts.FunctionLikeDeclaration) {
	if (node.name && ts.isIdentifier(node.name)) return node.name.text;
	let parent: ts.Node | undefined = node.parent;
	if (parent && ts.isCallExpression(parent)) parent = parent.parent;
	return parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) ? parent.name.text : '';
}

describe('component conventions', () => {
	it('reads component props through `props` instead of destructuring them', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			const sourceFile = ts.createSourceFile(
				file,
				readFileSync(file, 'utf8'),
				ts.ScriptTarget.Latest,
				true,
				ts.ScriptKind.TSX
			);
			const visit = (node: ts.Node) => {
				if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
					const name = componentName(node);
					const parameter = node.parameters[0];
					if (/^[A-Z]/.test(name) && parameter && ts.isObjectBindingPattern(parameter.name)) {
						offenders.push(`${path.relative(process.cwd(), file)} ${name}`);
					}
				}
				ts.forEachChild(node, visit);
			};
			visit(sourceFile);
		}
		expect(offenders).toEqual([]);
	});
});
