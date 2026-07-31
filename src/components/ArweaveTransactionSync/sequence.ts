export type SequencePhaseBounds = {
	start: number;
	end: number;
};

export function sequencePhaseBounds(index: number, count: number): SequencePhaseBounds {
	if (!Number.isSafeInteger(count) || count < 1) throw new TypeError('invalid-sequence-phase-count');
	if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
		throw new TypeError('invalid-sequence-phase-index');
	}
	return {
		start: (index / count) * 100,
		end: ((index + 1) / count) * 100,
	};
}
