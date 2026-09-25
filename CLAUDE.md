# Claude instructions

Read and follow the shared repository contract before acting on every prompt:

@AGENTS.md

Invoke `permaweb-frontend-code-style` through the Skill tool or `/permaweb-frontend-code-style` before repository work.
Read its complete frontend conventions on every task and its permaweb conventions whenever wallet, Arweave, AO,
gateway, cache, service-worker, or deployment behavior is in scope. The SessionStart and UserPromptSubmit hooks in
`.claude/settings.json` repeat this reminder and report the current validator status.

Claude discovers the skill through `.claude/skills/permaweb-frontend-code-style`, a symlink to
`.agents/skills/permaweb-frontend-code-style`. Edit only the canonical `.agents/` copy so Claude and Codex use the same
architecture contract.

Run `npm run check:architecture`, `npm run typecheck`, and relevant focused tests after frontend changes. Follow the
build and server limits in `AGENTS.md`. `npm run check:frontend` runs the shared enforcement gate.
