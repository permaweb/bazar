#!/usr/bin/env node

// Injects the repository's required frontend architecture contract into every Claude Code
// session and prompt. The canonical skill lives in .agents/skills/ so Codex reads the same rules.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SKILL = 'permaweb-frontend-code-style';
const SKILL_PATH = `.agents/skills/${SKILL}`;

let event = 'UserPromptSubmit';
try {
	const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
	if (typeof input.hook_event_name === 'string') event = input.hook_event_name;
} catch {
	// Hooks without a JSON payload still receive the reminder.
}

const projectRoot = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

function validatorSummary() {
	const validator = path.join(projectRoot, SKILL_PATH, 'scripts', 'validate_frontend_architecture.mjs');
	if (!fs.existsSync(validator))
		return 'Architecture validator is missing; restore the canonical skill before editing.';
	const result = spawnSync(process.execPath, [validator, '--root', projectRoot], {
		encoding: 'utf8',
		timeout: 20_000,
	});
	if (result.status === 0) return result.stdout.trim();
	const lines = `${result.stderr ?? ''}`.trim().split('\n').filter(Boolean);
	const summary = lines.at(-1) ?? 'Frontend architecture validation failed.';
	return `${summary} Run \`npm run check:architecture\` for the full list and fix drift in scope.`;
}

const reminder = [
	`Repository contract: before acting on this prompt, invoke the \`${SKILL}\` skill (Skill tool) and follow it.`,
	`Read ${SKILL_PATH}/references/frontend-conventions.md completely; also read references/permaweb-conventions.md when wallets, Arweave, AO, gateways, caches, service workers, or deployment are in scope.`,
	'Follow AGENTS.md. After frontend changes run `npm run check:frontend` (architecture, lint, typecheck, tests).',
];

if (event === 'SessionStart') reminder.push(`Current state: ${validatorSummary()}`);

process.stdout.write(
	JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: reminder.join('\n') } })
);
