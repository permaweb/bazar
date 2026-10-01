#!/usr/bin/env node
// Resolve a stylesheet merge where every side only deletes rules.
//
// Several agents remove their own components' rules from the same global stylesheet. A line-level
// union of deletions breaks as soon as two sides delete overlapping ranges inside one grouped rule,
// so this resolver works on the parsed CSS instead: it drops a base node when either side dropped
// it, and keeps the base's own formatting for everything that survives.
//
// Usage: merge-style-deletions.mjs <base-ref> <ours-ref> <theirs-ref> <path>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const postcss = require('postcss');

const [baseRef, oursRef, theirsRef, target] = process.argv.slice(2);

function read(ref) {
	return execFileSync('git', ['show', `${ref}:${target}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
}

// A node's identity: what it selects and what it declares, independent of formatting.
function signature(node) {
	if (node.type === 'rule') {
		const declarations = node.nodes?.map((child) => signature(child)).join(';') ?? '';
		return `rule|${node.selector.replace(/\s+/g, ' ').trim()}|${declarations}`;
	}
	if (node.type === 'atrule') {
		const children = node.nodes?.map((child) => signature(child)).join('||') ?? '';
		return `at|${node.name} ${(node.params ?? '').replace(/\s+/g, ' ').trim()}|${children}`;
	}
	if (node.type === 'decl') return `${node.prop}:${node.value.replace(/\s+/g, ' ').trim()}`;
	if (node.type === 'comment') return `comment|${node.text.replace(/\s+/g, ' ').trim()}`;
	return `${node.type}`;
}

function counts(css) {
	const present = new Map();
	postcss.parse(css).walk((node) => {
		if (node.parent?.type === 'root' || node.parent?.type === 'atrule' || node.parent?.type === 'rule') {
			const key = signature(node);
			present.set(key, (present.get(key) ?? 0) + 1);
		}
	});
	return present;
}

const baseCss = read(baseRef);
const kept = [counts(read(oursRef)), counts(read(theirsRef))];
const root = postcss.parse(baseCss);
let dropped = 0;

// Walk deepest-first so a container is judged after its children have been filtered.
const nodes = [];
root.walk((node) => nodes.push(node));
for (const node of nodes.reverse()) {
	if (node.type === 'decl') continue;
	if (!node.parent) continue;
	const key = signature(node);
	const survives = kept.every((side) => (side.get(key) ?? 0) > 0);
	if (survives) {
		for (const side of kept) side.set(key, side.get(key) - 1);
		continue;
	}
	// An at-rule that still has children was only partly emptied; keep the remainder.
	if (node.type === 'atrule' && node.nodes?.length) continue;
	node.remove();
	dropped += 1;
}

fs.writeFileSync(target, root.toString());
const before = baseCss.split('\n').length;
const after = root.toString().split('\n').length;
console.log(`${target}: ${before} -> ${after} lines, ${dropped} nodes dropped by either side`);
