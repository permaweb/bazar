import type { ArweaveAcceptedProof } from 'api/arweave-mining-telemetry';

const MAX_ACCEPTED_PROOFS = 10;

export function insertAcceptedProof(
  current: ArweaveAcceptedProof[],
  proof: ArweaveAcceptedProof,
): ArweaveAcceptedProof[] {
  return current.some((entry) => entry.key === proof.key) ? current : upsertAcceptedProof(current, proof);
}

export function upsertAcceptedProof(
  current: ArweaveAcceptedProof[],
  proof: ArweaveAcceptedProof,
): ArweaveAcceptedProof[] {
  return [...current.filter((entry) => entry.key !== proof.key), proof]
    .sort((left, right) => left.height - right.height)
    .slice(-MAX_ACCEPTED_PROOFS);
}
