import ts from 'typescript';

// Detects user-facing English written directly in source instead of a message catalog (`messages.ts`).
// The rules are heuristics tuned for this codebase: prose in JSX, copy-bearing attributes, and
// sentence-like string literals. Diagnostics (errors, logs) and machine values are exempt.

export type CopyFinding = { line: number; text: string };

const COPY_ATTRIBUTES = /^(?:aria-(?:label|description|valuetext|roledescription|placeholder)|alt|title|placeholder)$/;
const COPY_PROPS =
	/(?:^|[a-z])(?:Label|Title|Text|Heading|Eyebrow|Detail|Description|Message|Caption|Tooltip|Summary|Hint|Announcement|Placeholder|Prompt|Copy|Subtitle|Status|Content)$|^(?:label|title|text|heading|eyebrow|detail|description|message|caption|tooltip|summary|hint|announcement|placeholder|prompt|content|subtitle|status|children|ariaLabel|emptyLabel|action)$/;
const TECHNICAL_ATTRIBUTES =
	/^(?:className|class|id|key|type|role|name|href|to|src|srcSet|rel|target|lang|dir|htmlFor|form|method|accept|autoComplete|inputMode|enterKeyHint|pattern|variant|tone|size|layout|icon|kind|as|style|mode|align|placement|side|data-[\w-]+|aria-(?:labelledby|describedby|controls|owns|activedescendant|details|errormessage|flowto|live|relevant|current|haspopup|orientation|sort|autocomplete|hidden|modal|busy|atomic|expanded|selected|pressed|checked|disabled|invalid|required|readonly|multiselectable|level|posinset|setsize|valuemin|valuemax|valuenow|colcount|colindex|rowcount|rowindex|keyshortcuts))$/;
const DIAGNOSTIC_CALLEES =
	/^(?:Error|TypeError|RangeError|DOMException|AppError|appError|toAppError|console\.\w+|logger\.\w+|report\w*|debug|warn|invariant|assert\w*|Symbol|require|import|querySelector|querySelectorAll|closest|matches|getElementById|getAttribute|setAttribute|removeAttribute|addEventListener|removeEventListener|dispatchEvent|CustomEvent|Event|matchMedia|createElement|setProperty|getPropertyValue|fetch|URL|RegExp|Intl\.\w+|toLocaleString|toLocaleDateString|toLocaleTimeString|localeCompare|split|join|replace|replaceAll|startsWith|endsWith|includes|indexOf|test|match|padStart|padEnd|get|set|has|delete|getItem|setItem|removeItem|postMessage|keyframes|css|styled\.\w+|createGlobalStyle)$/;
const PROSE = /\p{Lu}\p{Ll}+|\p{Ll}{2,}\s+\p{L}{2,}/u;
const SENTENCE = /^\p{Lu}\p{Ll}*(?:[\s,.'’:;!?…()-]|$)|^\p{Ll}{2,}(?:\s+\p{L}+){2,}/u;
const MACHINE =
	/^(?:[\w.-]+\/[\w.+-]+|[A-Z0-9_]+|#?[\w-]+:[\w-]+|https?:\/\/\S+|\S+\.(?:png|jpe?g|webp|gif|svg|mp3|wav|json)|[\w-]+\s*\([^)]*\))$/;
const CLASS_LIST = /^-?[a-z0-9_]+(?:-{1,2}[a-z0-9_]+)*-*(?:\s+-?[a-z0-9_]+(?:-{1,2}[a-z0-9_]+)*-*)*$/;
const GRAPHQL = /^\s*(?:query|mutation|fragment|subscription)\b/;
const KEY_NAMES =
	/^(?:Enter|Escape|Tab|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right)|Backspace|Delete|Space|Shift|Control|Alt|Meta)$/;

function calleeName(node: ts.CallExpression | ts.NewExpression): string {
	const expression = node.expression;
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) {
		const owner = ts.isIdentifier(expression.expression) ? `${expression.expression.text}.` : '';
		return owner && /^(?:console|logger|styled|Intl)\.$/.test(owner)
			? `${owner}${expression.name.text}`
			: expression.name.text;
	}
	return '';
}

function isExempt(node: ts.Node): boolean {
	for (let current: ts.Node = node; current.parent; current = current.parent) {
		const parent = current.parent;
		if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
		if (ts.isLiteralTypeNode(parent) || ts.isTypeNode(parent)) return true;
		if (ts.isPropertyAssignment(parent) && parent.name === current) return true;
		if (ts.isElementAccessExpression(parent) && parent.argumentExpression === current) return true;
		if (ts.isCaseClause(parent) && parent.expression === current) return true;
		if (
			ts.isBinaryExpression(parent) &&
			[
				ts.SyntaxKind.EqualsEqualsEqualsToken,
				ts.SyntaxKind.ExclamationEqualsEqualsToken,
				ts.SyntaxKind.EqualsEqualsToken,
				ts.SyntaxKind.ExclamationEqualsToken,
				ts.SyntaxKind.InKeyword,
			].includes(parent.operatorToken.kind)
		) {
			return true;
		}
		if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && current !== parent.expression) {
			if (DIAGNOSTIC_CALLEES.test(calleeName(parent))) return true;
		}
		if (ts.isTaggedTemplateExpression(parent)) return true;
		if (ts.isJsxAttribute(parent)) {
			const name = parent.name.getText();
			return TECHNICAL_ATTRIBUTES.test(name) || !(COPY_ATTRIBUTES.test(name) || COPY_PROPS.test(name));
		}
		if (ts.isPropertyAssignment(parent) && parent.initializer === current) {
			const name = parent.name.getText().replace(/['"]/g, '');
			if (TECHNICAL_ATTRIBUTES.test(name)) return true;
			if (COPY_PROPS.test(name)) return false;
		}
		if (ts.isJsxExpression(parent) || ts.isJsxElement(parent) || ts.isJsxFragment(parent)) return false;
	}
	return false;
}

function literalText(node: ts.Node): string | null {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isTemplateExpression(node)) {
		return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
	}
	return null;
}

function looksLikeCopy(text: string): boolean {
	const value = text.trim();
	if (value.length < 2 || !PROSE.test(value)) return false;
	if (MACHINE.test(value) || KEY_NAMES.test(value) || GRAPHQL.test(value)) return false;
	if (CLASS_LIST.test(value) && value.includes('-')) return false;
	return SENTENCE.test(value) || /\s/.test(value);
}

export function findHardcodedCopy(fileName: string, sourceText: string): CopyFinding[] {
	const source = ts.createSourceFile(
		fileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);
	const findings: CopyFinding[] = [];
	const record = (node: ts.Node, text: string) => {
		findings.push({
			line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
			text: text.trim().replace(/\s+/g, ' ').slice(0, 80),
		});
	};
	const visit = (node: ts.Node) => {
		if (ts.isJsxText(node)) {
			if (/\p{L}{2,}/u.test(node.text)) record(node, node.text);
			return;
		}
		const text = literalText(node);
		if (text !== null) {
			if (looksLikeCopy(text) && !isExempt(node)) record(node, text);
			if (!ts.isTemplateExpression(node)) return;
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return findings;
}
