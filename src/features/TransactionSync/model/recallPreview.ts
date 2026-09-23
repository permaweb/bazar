import { type ArweaveRecallContent, type ArweaveRecallContentKind, canPreviewRecallImage } from 'api/mining-telemetry';

export type RecallContentPreview =
	| { kind: 'text'; text: string }
	/** An image small enough to load directly from its gateway URL. */
	| { kind: 'image'; src: string; title: string }
	/** An image of unknown size, loaded through a bounded fetch before display. */
	| { kind: 'bounded-image'; content: ArweaveRecallContent; title: string };

/** Chooses how a mining recall sample's content is previewed on its proof pin. */
export function recallContentPreview(
	content: ArweaveRecallContent | undefined,
	fallback: string
): RecallContentPreview {
	if (!content) return { kind: 'text', text: fallback };
	const title = content.contentType ?? fallback;
	if (canPreviewRecallImage(content)) return { kind: 'image', src: content.contentUrl, title };
	if (content.kind === 'image' && content.contentLength === undefined) {
		return { kind: 'bounded-image', content, title };
	}
	return {
		kind: 'text',
		text: content.metadata?.length ? content.metadata.join(' · ') : contentSymbol(content.kind),
	};
}

function contentSymbol(kind: ArweaveRecallContentKind): string {
	if (kind === 'audio') return '♪';
	if (kind === 'video') return '▶';
	if (kind === 'html') return '</>';
	if (kind === 'pdf') return 'PDF';
	if (kind === 'json') return '{}';
	if (kind === 'text') return 'Aa';
	return '◫';
}
