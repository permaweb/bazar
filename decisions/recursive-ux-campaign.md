# Recursive UX campaign

## Prompt

Improve Bazar's UX recursively on a separate branch, using many sub-agent idea
and review rounds. Continue until halted. Preserve a set of independently
mergeable candidate commits and aim for an exceptional, clean, robust product.

## Constraints

- Preserve Bazar's familiar visual identity and decentralized architecture.
- Keep live HyperBEAM state authoritative; do not add backends or persistence.
- Do not weaken transaction safety, recovery, or exact-value handling.
- Prefer coherent, reviewable improvements over broad aesthetic churn.
- Validate visual work in a browser; tests alone do not establish UX quality.

## Iteration model

1. Capture current desktop and mobile baselines for every major route and flow.
2. Ask independent reviewers to critique visual design, interaction,
   accessibility, information architecture, performance, and trust signals.
3. Select the smallest compatible group of high-leverage findings.
4. Implement it as one candidate commit with tests and screenshot evidence.
5. Ask fresh or adversarial reviewers to challenge the result.
6. Repeat, retaining successful commits as a clean candidate series.

## Initial decision

Start with evidence and audits rather than visual churn. The current product is
already functional and has completed real settlements; the campaign should
increase clarity, confidence, speed, and delight without obscuring or
destabilizing those proven flows.
