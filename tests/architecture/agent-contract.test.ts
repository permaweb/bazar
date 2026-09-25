import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SKILL = 'permaweb-frontend-code-style';

describe('agent contract', () => {
	it('exposes the canonical skill to Codex and Claude from one source', () => {
		expect(existsSync(`.agents/skills/${SKILL}/SKILL.md`)).toBe(true);
		expect(existsSync(`.agents/skills/${SKILL}/agents/openai.yaml`)).toBe(true);
		expect(existsSync(`.agents/skills/${SKILL}/agents/claude.yaml`)).toBe(true);
		const link = `.claude/skills/${SKILL}`;
		expect(lstatSync(link).isSymbolicLink()).toBe(true);
		expect(readlinkSync(link)).toBe(`../../.agents/skills/${SKILL}`);
	});

	it('requires the skill in the Codex and Claude instruction files', () => {
		expect(readFileSync('AGENTS.md', 'utf8')).toContain(`$${SKILL}`);
		const claude = readFileSync('CLAUDE.md', 'utf8');
		expect(claude).toContain('@AGENTS.md');
		expect(claude).toContain(SKILL);
	});

	it('injects the skill reminder on every Claude Code session start and prompt', () => {
		const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8'));
		for (const event of ['SessionStart', 'UserPromptSubmit']) {
			const commands = settings.hooks[event].flatMap((entry: { hooks: Array<{ command: string }> }) =>
				entry.hooks.map((hook) => hook.command)
			);
			expect(commands.some((command: string) => command.includes('permaweb-frontend-skill.mjs'))).toBe(true);
		}
		const result = spawnSync(process.execPath, [path.resolve('.claude/hooks/permaweb-frontend-skill.mjs')], {
			encoding: 'utf8',
			input: JSON.stringify({ hook_event_name: 'UserPromptSubmit' }),
			env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() },
		});
		const output = JSON.parse(result.stdout);
		expect(output.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
		expect(output.hookSpecificOutput.additionalContext).toContain(SKILL);
	});
});
