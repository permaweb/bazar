export const REFERENCE_DEVICE = 'reference@1.0';
export const ARWEAVE_ID = /^[A-Za-z0-9_-]{43}$/;

export function assertArweaveId(value, label) {
  if (!ARWEAVE_ID.test(value ?? '')) throw new Error(`${label}-must-be-a-43-character-arweave-id`);
  return value;
}

export function initialReferenceTags({ authority, target, timestamp }) {
  assertArweaveId(authority, 'authority');
  assertArweaveId(target, 'reference-value');
  assertTimestamp(timestamp);
  return [
    { name: 'device', value: REFERENCE_DEVICE },
    { name: 'authority', value: authority },
    { name: 'timestamp', value: String(timestamp) },
    { name: 'reference-value', value: target },
  ];
}

export function setReferenceTags({ referenceId, target, timestamp }) {
  assertArweaveId(referenceId, 'reference-id');
  assertArweaveId(target, 'reference-value');
  assertTimestamp(timestamp);
  return [
    { name: 'device', value: REFERENCE_DEVICE },
    { name: 'reference-id', value: referenceId },
    { name: 'timestamp', value: String(timestamp) },
    { name: 'reference-value', value: target },
  ];
}

export function nextReferenceTimestamp(now, ...knownTimestamps) {
  assertTimestamp(now);
  const known = knownTimestamps
    .filter((value) => value !== undefined && value !== null && Number(value) > 0)
    .map((value) => Number(value));
  for (const value of known) assertTimestamp(value);
  return Math.max(now, ...known.map((value) => value + 1));
}

export function tagsToObject(tags) {
  return Object.fromEntries(tags.map(({ name, value }) => [name, value]));
}

function assertTimestamp(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('timestamp-must-be-a-positive-safe-integer');
}
