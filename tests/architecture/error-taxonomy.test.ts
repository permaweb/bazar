import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve('src');
/** Adapters convert provider failures; the taxonomy module normalizes them. Everything else branches on AppError. */
const EXEMPT = [path.join(sourceRoot, 'api') + path.sep, path.join(sourceRoot, 'helpers', 'app-error.ts')];
const ERROR_CLASS = /^(?:[A-Z][A-Za-z]*)?Error$|^DOMException$/;
const PROVIDER_ERROR_FIELDS = new Set(['message', 'name']);

function sourceFiles(directory = sourceRoot): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [entryPath] : [];
	});
}

function isFunctionLiteral(node: ts.Node | undefined): node is ts.ArrowFunction | ts.FunctionExpression {
	return Boolean(node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)));
}

/** Identifiers holding a caught value: `catch (cause)`, `.catch((cause) => …)`, and `.then(…, (cause) => …)`. */
function caughtBindings(sourceFile: ts.SourceFile): Set<ts.Identifier> {
	const bindings = new Set<ts.Identifier>();
	const addFirstParameter = (callback: ts.Node | undefined) => {
		const parameter = isFunctionLiteral(callback) ? callback.parameters[0] : undefined;
		if (parameter && ts.isIdentifier(parameter.name)) bindings.add(parameter.name);
	};
	const visit = (node: ts.Node) => {
		if (ts.isCatchClause(node) && node.variableDeclaration && ts.isIdentifier(node.variableDeclaration.name)) {
			bindings.add(node.variableDeclaration.name);
		}
		if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
			const method = node.expression.name.text;
			if (method === 'catch') addFirstParameter(node.arguments[0]);
			if (method === 'then') addFirstParameter(node.arguments[1]);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return bindings;
}

/** Resolve an identifier to its nearest catch or parameter declaration and report whether that holds a caught value. */
function isCaughtIdentifier(identifier: ts.Identifier, bindings: Set<ts.Identifier>): boolean {
	for (let scope: ts.Node | undefined = identifier.parent; scope; scope = scope.parent) {
		if (ts.isCatchClause(scope)) {
			const name = scope.variableDeclaration?.name;
			if (name && ts.isIdentifier(name) && name.text === identifier.text) return bindings.has(name);
		}
		if (ts.isFunctionLike(scope)) {
			const parameter = scope.parameters.find(
				(candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === identifier.text
			);
			if (parameter) return bindings.has(parameter.name as ts.Identifier);
		}
	}
	return false;
}

function unwrap(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) current = current.expression;
	return current;
}

function assertsErrorType(expression: ts.Expression): boolean {
	const current = unwrap(expression);
	if (!ts.isAsExpression(current) && !ts.isTypeAssertionExpression(current)) return false;
	return ts.isTypeReferenceNode(current.type) && ERROR_CLASS.test(current.type.typeName.getText());
}

/**
 * Report every place a UI-layer module classifies a raw caught value instead of normalizing it with `toAppError`:
 * `instanceof` checks against error classes, reads of a caught value's provider `message` or `name`, and the same
 * reads through an `as Error` assertion.
 */
function rawErrorClassifications(fileName: string, text: string): string[] {
	const sourceFile = ts.createSourceFile(
		fileName,
		text,
		ts.ScriptTarget.Latest,
		true,
		fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);
	const bindings = caughtBindings(sourceFile);
	const findings: string[] = [];
	const report = (node: ts.Node, rule: string) => {
		const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
		findings.push(`${fileName}:${line + 1} ${rule}: ${node.getText(sourceFile)}`);
	};
	const isCaught = (expression: ts.Expression) => {
		const current = unwrap(expression);
		return (ts.isIdentifier(current) && isCaughtIdentifier(current, bindings)) || assertsErrorType(expression);
	};
	const visit = (node: ts.Node) => {
		if (
			ts.isBinaryExpression(node) &&
			node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
			ts.isIdentifier(node.right) &&
			ERROR_CLASS.test(node.right.text) &&
			node.right.text !== 'AppError'
		) {
			report(node, 'instanceof error class');
		}
		if (
			(ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) &&
			PROVIDER_ERROR_FIELDS.has(node.name.text) &&
			isCaught(node.expression)
		) {
			report(node, 'provider error field');
		}
		if (
			ts.isElementAccessExpression(node) &&
			ts.isStringLiteralLike(node.argumentExpression) &&
			PROVIDER_ERROR_FIELDS.has(node.argumentExpression.text) &&
			isCaught(node.expression)
		) {
			report(node, 'provider error field');
		}
		if (
			ts.isVariableDeclaration(node) &&
			ts.isObjectBindingPattern(node.name) &&
			node.initializer &&
			isCaught(node.initializer) &&
			node.name.elements.some((element) =>
				PROVIDER_ERROR_FIELDS.has((element.propertyName ?? element.name).getText(sourceFile))
			)
		) {
			report(node, 'provider error field');
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return findings;
}

describe('error taxonomy boundary', () => {
	it('keeps raw error classification inside API adapters and the taxonomy module', () => {
		const findings = sourceFiles()
			.filter((file) => !EXEMPT.some((exempt) => file === exempt || file.startsWith(exempt)))
			.flatMap((file) => rawErrorClassifications(path.relative(process.cwd(), file), readFileSync(file, 'utf8')));
		expect(findings).toEqual([]);
	});

	it('removes the legacy message-matching helpers', () => {
		const imports = sourceFiles().filter((file) =>
			/from '(?:helpers\/)?(?:marketplace|mint)-error'/.test(readFileSync(file, 'utf8'))
		);
		expect(imports).toEqual([]);
	});

	it.each([
		['catch clause message', `try { run(); } catch (cause) { show(cause.message); }`],
		['optional message read', `try { run(); } catch (error) { show(error?.message ?? ''); }`],
		['promise catch callback', `load().catch((error) => setError(error.message));`],
		['rejection handler', `load().then(render, (cause) => setError(String(cause.name)));`],
		['destructured message', `try { run(); } catch (cause) { const { message } = cause as Error; show(message); }`],
		['error assertion', `promise.catch((reason: unknown) => (reason as Error).name === 'AbortError');`],
		['instanceof classification', `const text = cause instanceof Error ? 'failed' : 'unknown';`],
		['subclass classification', `const tooLarge = cause instanceof RangeError;`],
	])('flags %s', (_label, source) => {
		expect(rawErrorClassifications('fixture.ts', source)).toHaveLength(1);
	});

	it.each([
		['normalized error', `try { run(); } catch (cause) { show(appErrorMessage(toAppError(cause, 'unknown'))); }`],
		['AppError narrowing', `if (cause instanceof AppError) retry(cause.reason);`],
		['non-caught message', `const text = notice.message; const { message } = props;`],
		['shadowed name', `try { run(); } catch (cause) { log(cause); } const message = state.cause.message;`],
		['fulfilled handler', `load().then((result) => show(result.message));`],
	])('allows %s', (_label, source) => {
		expect(rawErrorClassifications('fixture.ts', source)).toEqual([]);
	});
});
