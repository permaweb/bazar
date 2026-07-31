const MAX_DIFFICULTY = (1n << 256n) - 1n;
// Draft 17 targets one accepted block every two minutes.
const TARGET_BLOCK_SECONDS = 120;
// Draft 17 used 100 MiB recall ranges. Composite/replica packing uses
// (25 MiB / packing difficulty); current replica-format blocks use difficulty 10.
const LEGACY_RECALL_RANGE_BYTES = 100 * 1024 * 1024;
const COMPOSITE_RECALL_RANGE_BYTES = 25 * 1024 * 1024;
// Per VDF step and fully stored partition: 400 H2 candidates plus 400 H1
// candidates normalized by the protocol's 100x PoA1 difficulty multiplier.
const NORMALIZED_CANDIDATES_PER_STEP = 404;

export type ArweaveRecallContentKind = 'image' | 'text' | 'json' | 'html' | 'video' | 'audio' | 'pdf' | 'binary';

export type ArweaveRecallContent = {
	contentLength?: number;
	metadata?: string[];
	contentType?: string;
	contentUrl: string;
	kind: ArweaveRecallContentKind;
};

export type ArweaveRecallSample = {
	index: number;
	offset: number;
	packedBytes?: number;
	unpackedBytes?: number;
	absoluteEndOffset?: number;
	sourceHeight?: number;
	sourceTimestamp?: number;
	sourceBlockId?: string;
	content?: ArweaveRecallContent;
};

export type ArweaveAcceptedProof = {
	key: string;
	height: number;
	blockId: string;
	miningAddress?: string;
	proofCount: number;
	recallBytes: number[];
	recallSamples: ArweaveRecallSample[];
	packingDifficulty?: number;
	replicaFormat?: number;
	vdfStep?: number;
	transactionCount: number;
	blockSize?: number;
	weaveSize?: number;
	difficulty?: string;
	expectedCandidates?: number;
	estimatedCandidateRate?: number;
	recallRangeBytes?: number;
	estimatedDiskReadRate?: number;
	timestamp?: number;
	observedAt: number;
};

type ArweavePoa = {
	chunk?: unknown;
};

type ArweaveBlock = {
	height?: unknown;
	indep_hash?: unknown;
	reward_addr?: unknown;
	poa?: unknown;
	poa2?: unknown;
	recall_byte?: unknown;
	recall_byte2?: unknown;
	packing_difficulty?: unknown;
	replica_format?: unknown;
	txs?: unknown;
	block_size?: unknown;
	weave_size?: unknown;
	diff?: unknown;
	timestamp?: unknown;
	nonce_limiter_info?: { global_step_number?: unknown };
};

type BlockLocation = {
	height: number;
	blockId: string;
	timestamp?: number;
	weaveSize: number;
};

type RecallChunk = {
	absolute_end_offset?: unknown;
	chunk?: unknown;
	chunk_size?: unknown;
};

export function parseAcceptedBlockProof(value: unknown, observedAt = Date.now()): ArweaveAcceptedProof | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const block = value as ArweaveBlock;
	const height = finiteNumber(block.height);
	const blockId = stringValue(block.indep_hash);
	if (height === undefined || !blockId) return undefined;
	const proofEntries = [block.poa, block.poa2].filter(isPoa);
	if (!proofEntries.length) return undefined;
	const recallBytes = [finiteNumber(block.recall_byte), finiteNumber(block.recall_byte2)].filter(
		(byte): byte is number => byte !== undefined
	);
	const packingDifficulty = finiteNumber(block.packing_difficulty);
	const difficulty = integerString(block.diff);
	const expectedCandidates = difficulty ? expectedCandidatesForDifficulty(difficulty) : undefined;
	const estimatedCandidateRate =
		expectedCandidates === undefined ? undefined : expectedCandidates / TARGET_BLOCK_SECONDS;
	const recallRangeBytes =
		packingDifficulty === undefined
			? undefined
			: packingDifficulty === 0
			? LEGACY_RECALL_RANGE_BYTES
			: COMPOSITE_RECALL_RANGE_BYTES / packingDifficulty;
	const estimatedDiskReadRate =
		estimatedCandidateRate === undefined || recallRangeBytes === undefined
			? undefined
			: estimatedCandidateRate * ((2 * recallRangeBytes) / NORMALIZED_CANDIDATES_PER_STEP);
	const txs = Array.isArray(block.txs) ? block.txs : [];
	return {
		key: `${height}:${blockId}`,
		height,
		blockId,
		...(stringValue(block.reward_addr) ? { miningAddress: stringValue(block.reward_addr) } : {}),
		proofCount: proofEntries.length,
		recallBytes,
		recallSamples: recallBytes.map((offset, index) => ({
			index: index + 1,
			offset,
			...(proofEntries[index] ? { packedBytes: encodedByteLength(stringValue(proofEntries[index].chunk)) } : {}),
		})),
		...(packingDifficulty === undefined ? {} : { packingDifficulty }),
		...(finiteNumber(block.replica_format) === undefined
			? {}
			: { replicaFormat: finiteNumber(block.replica_format) }),
		...(finiteNumber(block.nonce_limiter_info?.global_step_number) === undefined
			? {}
			: { vdfStep: finiteNumber(block.nonce_limiter_info?.global_step_number) }),
		transactionCount: txs.length,
		...(finiteNumber(block.block_size) === undefined ? {} : { blockSize: finiteNumber(block.block_size) }),
		...(finiteNumber(block.weave_size) === undefined ? {} : { weaveSize: finiteNumber(block.weave_size) }),
		...(difficulty ? { difficulty } : {}),
		...(expectedCandidates === undefined ? {} : { expectedCandidates }),
		...(estimatedCandidateRate === undefined ? {} : { estimatedCandidateRate }),
		...(recallRangeBytes === undefined ? {} : { recallRangeBytes }),
		...(estimatedDiskReadRate === undefined ? {} : { estimatedDiskReadRate }),
		...(finiteNumber(block.timestamp) === undefined ? {} : { timestamp: finiteNumber(block.timestamp) }),
		observedAt,
	};
}

export function expectedCandidatesForDifficulty(difficulty: string): number | undefined {
	try {
		const threshold = BigInt(difficulty);
		if (threshold < 0n || threshold >= MAX_DIFFICULTY) return undefined;
		const expected = MAX_DIFFICULTY / (MAX_DIFFICULTY - threshold);
		const number = Number(expected);
		return Number.isFinite(number) ? number : undefined;
	} catch {
		return undefined;
	}
}

export async function fetchCurrentBlockProof(origin: string, signal: AbortSignal): Promise<ArweaveAcceptedProof> {
	const response = await fetch(`${origin.replace(/\/$/, '')}/block/current`, {
		signal,
		headers: { accept: 'application/json', 'x-block-format': '2' },
	});
	if (!response.ok) throw new Error(`current-block-${response.status}`);
	const proof = parseAcceptedBlockProof(await response.json());
	if (!proof) throw new Error('current-block-proof-missing');
	return proof;
}

export async function enrichAcceptedBlockContent(
	proof: ArweaveAcceptedProof,
	signal: AbortSignal
): Promise<ArweaveAcceptedProof> {
	const recallSamples = await Promise.all(
		proof.recallSamples.map(async (sample) => ({
			...sample,
			content: sample.content ?? (await fetchRecallOffsetContent(sample.offset, signal)),
		}))
	);
	return { ...proof, recallSamples };
}

export async function enrichAcceptedBlockProof(
	origin: string,
	proof: ArweaveAcceptedProof,
	signal: AbortSignal
): Promise<ArweaveAcceptedProof> {
	const blockCache = new Map<number, Promise<BlockLocation>>();
	const recallSamples = await Promise.all(
		proof.recallSamples.map(async (sample) => {
			const [chunk, source, offsetContent] = await Promise.all([
				fetchRecallChunk(origin, sample.offset, signal).catch(() => undefined),
				proof.weaveSize === undefined
					? Promise.resolve(undefined)
					: locateRecallBlock(origin, sample.offset, proof.height, blockCache, signal).catch(() => undefined),
				sample.content
					? Promise.resolve(sample.content)
					: fetchRecallOffsetContent(sample.offset, signal).catch(() => undefined),
			]);
			return {
				...sample,
				...(chunk
					? {
							unpackedBytes: chunk.bytes.length,
							...(chunk.absoluteEndOffset === undefined
								? {}
								: { absoluteEndOffset: chunk.absoluteEndOffset }),
					  }
					: {}),
				...(source
					? {
							sourceHeight: source.height,
							sourceBlockId: source.blockId,
							...(source.timestamp === undefined ? {} : { sourceTimestamp: source.timestamp }),
					  }
					: {}),
				...(offsetContent ? { content: offsetContent } : {}),
			};
		})
	);
	return { ...proof, recallSamples };
}

async function fetchRecallOffsetContent(offset: number, signal: AbortSignal): Promise<ArweaveRecallContent> {
	const contentUrl = `https://${offset}b.arweave.net/`;
	let contentLength: number | undefined;
	let metadata: string[] | undefined;
	let contentType: string | undefined;
	try {
		const response = await fetch(contentUrl, { method: 'HEAD', signal });
		if (response.ok) {
			contentType = response.headers.get('content-type') ?? undefined;
			contentLength = responseContentLength(response.headers);
			metadata = recallContentMetadata(response.headers);
		}
	} catch (error) {
		if (signal.aborted) throw error;
	}
	return {
		...(contentLength === undefined ? {} : { contentLength }),
		...(metadata?.length ? { metadata } : {}),
		...(contentType ? { contentType } : {}),
		contentUrl,
		kind: contentKind(contentType),
	};
}

function responseContentLength(headers: Headers): number | undefined {
	const declaredLength = finiteNumber(headers.get('content-length'));
	if (declaredLength !== undefined) return declaredLength;
	const rangeTotal = headers.get('content-range')?.match(/\/(\d+)$/)?.[1];
	return finiteNumber(rangeTotal);
}

function recallContentMetadata(headers: Headers): string[] {
	const values = ['title', 'name', 'type', 'app-name', 'datafeedid', 'dataserviceid', 'uploadservice']
		.map((name) => headers.get(name)?.replace(/\s+/g, ' ').trim())
		.filter((value): value is string => Boolean(value))
		.map((value) => (value.length > 80 ? `${value.slice(0, 77)}…` : value));
	const digest = headers.get('content-digest')?.match(/^sha-256=:(.{8})/)?.[1];
	if (digest) values.push(`sha-256 ${digest}…`);
	return [...new Set(values)].slice(0, 3);
}

async function fetchRecallChunk(
	origin: string,
	offset: number,
	signal: AbortSignal
): Promise<{
	bytes: Uint8Array;
	absoluteEndOffset?: number;
}> {
	const response = await fetch(`${origin.replace(/\/$/, '')}/chunk/${offset}`, {
		signal,
		headers: { accept: 'application/json' },
	});
	if (!response.ok) throw new Error(`recall-chunk-${response.status}`);
	const value = (await response.json()) as RecallChunk;
	const encodedChunk = stringValue(value.chunk);
	if (!encodedChunk) throw new Error('recall-chunk-missing');
	const bytes = decodeBase64Url(encodedChunk);
	return {
		bytes,
		...(finiteNumber(value.absolute_end_offset) === undefined
			? {}
			: { absoluteEndOffset: finiteNumber(value.absolute_end_offset) }),
	};
}

async function locateRecallBlock(
	origin: string,
	offset: number,
	currentHeight: number,
	cache: Map<number, Promise<BlockLocation>>,
	signal: AbortSignal
): Promise<BlockLocation> {
	let low = 0;
	let high = currentHeight;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		const block = await fetchBlockLocation(origin, middle, cache, signal);
		if (block.weaveSize > offset) high = middle;
		else low = middle + 1;
	}
	return fetchBlockLocation(origin, low, cache, signal);
}

function fetchBlockLocation(
	origin: string,
	height: number,
	cache: Map<number, Promise<BlockLocation>>,
	signal: AbortSignal
): Promise<BlockLocation> {
	const cached = cache.get(height);
	if (cached) return cached;
	const request = fetch(`${origin.replace(/\/$/, '')}/block/height/${height}`, {
		signal,
		headers: { accept: 'application/json', 'x-block-format': '2' },
	}).then(async (response) => {
		if (!response.ok) throw new Error(`recall-block-${response.status}`);
		const block = (await response.json()) as ArweaveBlock;
		const blockHeight = finiteNumber(block.height);
		const blockId = stringValue(block.indep_hash);
		const weaveSize = finiteNumber(block.weave_size);
		if (blockHeight === undefined || !blockId || weaveSize === undefined) {
			throw new Error('recall-block-invalid');
		}
		return {
			height: blockHeight,
			blockId,
			weaveSize,
			...(finiteNumber(block.timestamp) === undefined ? {} : { timestamp: finiteNumber(block.timestamp) }),
		};
	});
	cache.set(height, request);
	return request;
}

export function contentKind(contentType: string | undefined): ArweaveRecallContentKind {
	const normalized = contentType?.split(';', 1)[0].trim().toLowerCase();
	if (!normalized) return 'binary';
	if (normalized.startsWith('image/')) return 'image';
	if (normalized === 'application/json' || normalized.endsWith('+json')) return 'json';
	if (normalized === 'text/html' || normalized === 'application/xhtml+xml') return 'html';
	if (normalized.startsWith('text/') || normalized.endsWith('+xml')) return 'text';
	if (normalized.startsWith('video/')) return 'video';
	if (normalized.startsWith('audio/')) return 'audio';
	if (normalized === 'application/pdf') return 'pdf';
	return 'binary';
}

function decodeBase64Url(value: string): Uint8Array {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
	const decoded = atob(`${normalized}${padding}`);
	return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function encodedByteLength(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
	return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

function isPoa(value: unknown): value is ArweavePoa {
	return Boolean(value && typeof value === 'object' && Object.keys(value).length);
}

function finiteNumber(value: unknown): number | undefined {
	const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
	return Number.isFinite(number) ? number : undefined;
}

function integerString(value: unknown): string | undefined {
	if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
	return typeof value === 'string' && /^\d+$/.test(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}
