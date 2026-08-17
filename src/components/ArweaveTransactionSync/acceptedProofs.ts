import type { ArweaveAcceptedProof } from 'api/arweave-mining-telemetry';

const MAX_ACCEPTED_PROOFS = 10;

export const ACCEPTED_PROOF_ANNOTATION_HOLD_MS = 10_000;
export const ACCEPTED_PROOF_ANNOTATION_FADE_IN_MS = 360;
export const ACCEPTED_PROOF_ANNOTATION_FADE_MS = 700;
export const ACCEPTED_PROOF_ANNOTATION_LIFETIME_MS =
	ACCEPTED_PROOF_ANNOTATION_HOLD_MS + ACCEPTED_PROOF_ANNOTATION_FADE_MS;

export function acceptedProofAnnotationIsVisible(observedAt: number, now = Date.now()): boolean {
	return now < observedAt + ACCEPTED_PROOF_ANNOTATION_LIFETIME_MS;
}

export function acceptedProofAnnotationOpacity(observedAt: number, now = Date.now()): number {
	const elapsed = Math.max(0, now - observedAt);
	if (elapsed < ACCEPTED_PROOF_ANNOTATION_FADE_IN_MS) {
		return elapsed / ACCEPTED_PROOF_ANNOTATION_FADE_IN_MS;
	}
	if (elapsed <= ACCEPTED_PROOF_ANNOTATION_HOLD_MS) return 1;
	return Math.max(0, 1 - (elapsed - ACCEPTED_PROOF_ANNOTATION_HOLD_MS) / ACCEPTED_PROOF_ANNOTATION_FADE_MS);
}

export function insertAcceptedProof(
	current: ArweaveAcceptedProof[],
	proof: ArweaveAcceptedProof
): ArweaveAcceptedProof[] {
	return current.some((entry) => entry.key === proof.key) ? current : upsertAcceptedProof(current, proof);
}

export function upsertAcceptedProof(
	current: ArweaveAcceptedProof[],
	proof: ArweaveAcceptedProof
): ArweaveAcceptedProof[] {
	return [...current.filter((entry) => entry.key !== proof.key), proof]
		.sort((left, right) => left.height - right.height)
		.slice(-MAX_ACCEPTED_PROOFS);
}
