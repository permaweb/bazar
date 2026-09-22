// Downloads an audio transaction for client-side waveform rendering.
export async function fetchAudioBytes(src: string, signal: AbortSignal): Promise<ArrayBuffer> {
	const response = await fetch(src, { signal });
	if (!response.ok) throw new Error(`waveform-fetch-${response.status}`);
	return response.arrayBuffer();
}
