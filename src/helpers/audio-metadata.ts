export type EmbeddedAudioMetadata = {
	title?: string;
	artist?: string;
	album?: string;
	duration?: number;
	artwork?: File;
};

const ID3_HEADER_BYTES = 10;

export async function extractEmbeddedAudioMetadata(file: File): Promise<EmbeddedAudioMetadata> {
	const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	let metadata: EmbeddedAudioMetadata = {};
	if (ascii(header, 0, 3) === 'ID3') metadata = await readId3File(file, header);
	else if (ascii(header, 0, 4) === 'RIFF' && ascii(header, 8, 12) === 'WAVE') {
		metadata = readWave(new Uint8Array(await file.arrayBuffer()));
	}
	if (/\.mp3$/i.test(file.name) && (!metadata.title || !metadata.artist || !metadata.album)) {
		metadata = { ...(await readId3v1(file)), ...metadata };
	}

	if (!metadata.duration && typeof document !== 'undefined') {
		const duration = await readBrowserDuration(file);
		if (duration) metadata.duration = duration;
	}
	return metadata;
}

async function readId3v1(file: File): Promise<EmbeddedAudioMetadata> {
	if (file.size < 128) return {};
	const bytes = new Uint8Array(await file.slice(file.size - 128).arrayBuffer());
	if (ascii(bytes, 0, 3) !== 'TAG') return {};
	const decode = (start: number, end: number) =>
		cleanText(new TextDecoder('latin1').decode(bytes.subarray(start, end)));
	return compactMetadata({ title: decode(3, 33), artist: decode(33, 63), album: decode(63, 93) });
}

export function formatAudioDuration(duration?: number) {
	if (!duration || !Number.isFinite(duration) || duration <= 0) return '';
	const seconds = Math.round(duration);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	return hours
		? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
		: `${minutes}:${String(remainder).padStart(2, '0')}`;
}

async function readId3File(file: File, header: Uint8Array) {
	const tagBytes = syncSafeInteger(header, 6) + ID3_HEADER_BYTES;
	return readId3(new Uint8Array(await file.slice(0, Math.min(file.size, tagBytes)).arrayBuffer()));
}

function readId3(bytes: Uint8Array): EmbeddedAudioMetadata {
	if (bytes.length < ID3_HEADER_BYTES || ascii(bytes, 0, 3) !== 'ID3') return {};
	const version = bytes[3];
	const limit = Math.min(bytes.length, ID3_HEADER_BYTES + syncSafeInteger(bytes, 6));
	const metadata: EmbeddedAudioMetadata = {};
	let offset = ID3_HEADER_BYTES;
	while (offset + 10 <= limit) {
		const id = ascii(bytes, offset, offset + 4);
		if (!/^[A-Z0-9]{4}$/.test(id)) break;
		const size = version === 4 ? syncSafeInteger(bytes, offset + 4) : bigEndianInteger(bytes, offset + 4);
		const bodyStart = offset + 10;
		const bodyEnd = Math.min(limit, bodyStart + size);
		if (size <= 0 || bodyEnd <= bodyStart) break;
		const body = bytes.subarray(bodyStart, bodyEnd);
		if (id === 'TIT2') metadata.title = cleanText(decodeId3Text(body));
		else if (id === 'TPE1') metadata.artist = cleanText(decodeId3Text(body));
		else if (id === 'TALB') metadata.album = cleanText(decodeId3Text(body));
		else if (id === 'TLEN') {
			const milliseconds = Number(cleanText(decodeId3Text(body)));
			if (Number.isFinite(milliseconds) && milliseconds > 0) metadata.duration = milliseconds / 1000;
		} else if (id === 'APIC') metadata.artwork = decodeAttachedPicture(body);
		offset = bodyStart + size;
	}
	return compactMetadata(metadata);
}

function readWave(bytes: Uint8Array): EmbeddedAudioMetadata {
	const metadata: EmbeddedAudioMetadata = {};
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let byteRate = 0;
	let dataBytes = 0;
	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const id = ascii(bytes, offset, offset + 4);
		const size = view.getUint32(offset + 4, true);
		const start = offset + 8;
		const end = Math.min(bytes.length, start + size);
		if (id === 'fmt ' && size >= 12 && start + 12 <= bytes.length) byteRate = view.getUint32(start + 8, true);
		else if (id === 'data') dataBytes = size;
		else if ((id === 'ID3 ' || id === 'id3 ') && end > start)
			Object.assign(metadata, readId3(bytes.subarray(start, end)));
		else if (id === 'LIST' && ascii(bytes, start, start + 4) === 'INFO') {
			Object.assign(metadata, readWaveInfo(bytes.subarray(start + 4, end)));
		}
		offset = start + size + (size % 2);
	}
	if (!metadata.duration && byteRate > 0 && dataBytes > 0) metadata.duration = dataBytes / byteRate;
	return compactMetadata(metadata);
}

function readWaveInfo(bytes: Uint8Array): EmbeddedAudioMetadata {
	const metadata: EmbeddedAudioMetadata = {};
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 0;
	while (offset + 8 <= bytes.length) {
		const id = ascii(bytes, offset, offset + 4);
		const size = view.getUint32(offset + 4, true);
		const start = offset + 8;
		const value = cleanText(new TextDecoder().decode(bytes.subarray(start, Math.min(bytes.length, start + size))));
		if (id === 'INAM') metadata.title = value;
		else if (id === 'IART') metadata.artist = value;
		else if (id === 'IPRD') metadata.album = value;
		offset = start + size + (size % 2);
	}
	return compactMetadata(metadata);
}

function decodeId3Text(bytes: Uint8Array) {
	if (!bytes.length) return '';
	return decodeText(bytes.subarray(1), bytes[0]);
}

function decodeAttachedPicture(bytes: Uint8Array): File | undefined {
	if (bytes.length < 5) return undefined;
	const encoding = bytes[0];
	const mimeEnd = bytes.indexOf(0, 1);
	if (mimeEnd < 0 || mimeEnd + 2 >= bytes.length) return undefined;
	const embeddedMime = new TextDecoder('latin1').decode(bytes.subarray(1, mimeEnd)) || 'image/jpeg';
	const mime = embeddedMime === 'image/jpg' ? 'image/jpeg' : embeddedMime;
	const descriptionStart = mimeEnd + 2;
	const descriptionEnd = findTextTerminator(bytes, descriptionStart, encoding);
	const artworkStart = descriptionEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
	if (artworkStart >= bytes.length || !mime.startsWith('image/')) return undefined;
	const extension = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
	return new File([bytes.slice(artworkStart)], `embedded-artwork.${extension}`, { type: mime });
}

function findTextTerminator(bytes: Uint8Array, start: number, encoding: number) {
	if (encoding === 1 || encoding === 2) {
		for (let offset = start; offset + 1 < bytes.length; offset += 2) {
			if (bytes[offset] === 0 && bytes[offset + 1] === 0) return offset;
		}
		return bytes.length - 2;
	}
	const end = bytes.indexOf(0, start);
	return end < 0 ? bytes.length - 1 : end;
}

function decodeText(bytes: Uint8Array, encoding: number) {
	if (encoding === 0) return new TextDecoder('latin1').decode(bytes);
	if (encoding === 3) return new TextDecoder().decode(bytes);
	if (encoding === 2) return new TextDecoder('utf-16be').decode(bytes);
	if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
	return new TextDecoder('utf-16le').decode(bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2) : bytes);
}

function readBrowserDuration(file: File) {
	return new Promise<number | undefined>((resolve) => {
		const audio = document.createElement('audio');
		const url = URL.createObjectURL(file);
		const finish = (duration?: number) => {
			audio.onloadedmetadata = null;
			audio.onerror = null;
			audio.removeAttribute('src');
			URL.revokeObjectURL(url);
			resolve(duration && Number.isFinite(duration) && duration > 0 ? duration : undefined);
		};
		const timer = window.setTimeout(() => finish(), 5000);
		audio.preload = 'metadata';
		audio.onloadedmetadata = () => {
			window.clearTimeout(timer);
			finish(audio.duration);
		};
		audio.onerror = () => {
			window.clearTimeout(timer);
			finish();
		};
		audio.src = url;
	});
}

function syncSafeInteger(bytes: Uint8Array, offset: number) {
	return (
		((bytes[offset] & 0x7f) << 21) |
		((bytes[offset + 1] & 0x7f) << 14) |
		((bytes[offset + 2] & 0x7f) << 7) |
		(bytes[offset + 3] & 0x7f)
	);
}

function bigEndianInteger(bytes: Uint8Array, offset: number) {
	return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
	return String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));
}

function cleanText(value?: string) {
	return value?.replace(/\0/g, '').trim() || undefined;
}

function compactMetadata(metadata: EmbeddedAudioMetadata) {
	return Object.fromEntries(
		Object.entries(metadata).filter(([, value]) => value !== undefined)
	) as EmbeddedAudioMetadata;
}
