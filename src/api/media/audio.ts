import { httpStatusError, transportFailure } from 'api/network/errors';

// Downloads an audio transaction for client-side waveform rendering.
export async function fetchAudioBytes(src: string, signal: AbortSignal): Promise<ArrayBuffer> {
	let response: Response;
	try {
		response = await fetch(src, { signal });
	} catch (cause) {
		throw signal.aborted ? cause : transportFailure(cause, 'waveform-fetch');
	}
	if (!response.ok) throw httpStatusError('waveform-fetch', response.status);
	return response.arrayBuffer();
}
