import { describe, expect, it } from 'vitest';

import { extractEmbeddedAudioMetadata, formatAudioDuration } from './audio-metadata';

function id3Frame(id: string, body: Uint8Array) {
	const frame = new Uint8Array(10 + body.length);
	frame.set(new TextEncoder().encode(id), 0);
	new DataView(frame.buffer).setUint32(4, body.length);
	frame.set(body, 10);
	return frame;
}

function textFrame(id: string, value: string) {
	const text = new TextEncoder().encode(value);
	return id3Frame(id, new Uint8Array([3, ...text]));
}

function syncSafe(value: number) {
	return [(value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f];
}

describe('embedded audio metadata', () => {
	it('extracts ID3 title, artist, album, duration, and artwork', async () => {
		const picture = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
		const apic = id3Frame(
			'APIC',
			new Uint8Array([3, ...new TextEncoder().encode('image/png'), 0, 3, 0, ...picture])
		);
		const frames = [
			textFrame('TIT2', 'Night Signal'),
			textFrame('TPE1', 'Kite Array'),
			textFrame('TALB', 'Long Orbit'),
			textFrame('TLEN', '125000'),
			apic,
		];
		const size = frames.reduce((total, frame) => total + frame.length, 0);
		const bytes = new Uint8Array(10 + size);
		bytes.set(new TextEncoder().encode('ID3'), 0);
		bytes.set([3, 0, 0, ...syncSafe(size)], 3);
		let offset = 10;
		for (const frame of frames) {
			bytes.set(frame, offset);
			offset += frame.length;
		}

		const metadata = await extractEmbeddedAudioMetadata(new File([bytes], 'signal.mp3', { type: 'audio/mpeg' }));

		expect(metadata).toMatchObject({
			title: 'Night Signal',
			artist: 'Kite Array',
			album: 'Long Orbit',
			duration: 125,
		});
		expect(metadata.artwork).toMatchObject({ name: 'embedded-artwork.png', type: 'image/png', size: 4 });
		expect(formatAudioDuration(metadata.duration)).toBe('2:05');
	});

	it('falls back to ID3v1 text fields', async () => {
		const bytes = new Uint8Array(128);
		bytes.set(new TextEncoder().encode('TAG'), 0);
		bytes.set(new TextEncoder().encode('Legacy title'), 3);
		bytes.set(new TextEncoder().encode('Legacy artist'), 33);
		bytes.set(new TextEncoder().encode('Legacy album'), 63);

		await expect(
			extractEmbeddedAudioMetadata(new File([bytes], 'legacy.mp3', { type: 'audio/mpeg' }))
		).resolves.toMatchObject({
			title: 'Legacy title',
			artist: 'Legacy artist',
			album: 'Legacy album',
		});
	});
});
