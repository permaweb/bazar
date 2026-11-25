export const DEFAULT_DOCUMENT_TITLE = 'Bazar — Arweave-native assets';

/** The document title for a route whose first `<h1>` reads `headingText`. */
export function routeDocumentTitle(headingText?: string | null) {
	const text = headingText?.trim();
	return text ? `${text} — Bazar` : DEFAULT_DOCUMENT_TITLE;
}

type RouteTitleObserve = (target: Node, options: MutationObserverInit, onMutation: () => void) => () => void;

export type RouteTitleEnvironment = {
	main: Pick<ParentNode, 'querySelector'> & Node;
	getTitle: () => string;
	setTitle: (title: string) => void;
	observe: RouteTitleObserve;
	requestFrame: (callback: () => void) => number;
	cancelFrame: (frame: number) => void;
};

export type RouteTitleTracker = {
	/** Re-read the route's heading now and write the title if it changed. */
	sync: () => void;
	stop: () => void;
};

/** Structural changes anywhere in the route: a heading added, removed or replaced. */
export const ROUTE_STRUCTURE_OBSERVATION: MutationObserverInit = { childList: true, subtree: true };
/** Text changes inside the current heading only, so card and price text updates never wake the tracker. */
export const ROUTE_HEADING_OBSERVATION: MutationObserverInit = { characterData: true, childList: true, subtree: true };

/**
 * Keeps the document title on the route's current `<h1>` for the life of a route. The heading can be
 * replaced (a loading state's "Collection" giving way to the collection page) or have its text
 * change in place (a short address giving way to a profile or token name). Mutations are coalesced
 * into one heading read per animation frame, and the title is written only when it differs.
 */
export function trackRouteDocumentTitle(env: RouteTitleEnvironment): RouteTitleTracker {
	let heading: Element | null = null;
	let stopHeading: (() => void) | null = null;
	let frame: number | null = null;
	let stopped = false;
	let title = DEFAULT_DOCUMENT_TITLE;

	const schedule = () => {
		if (stopped || frame !== null) return;
		frame = env.requestFrame(() => {
			frame = null;
			sync();
		});
	};

	const sync = () => {
		if (stopped) return;
		if (frame !== null) {
			env.cancelFrame(frame);
			frame = null;
		}
		const next = env.main.querySelector('h1');
		if (next !== heading) {
			stopHeading?.();
			heading = next;
			stopHeading = next ? env.observe(next, ROUTE_HEADING_OBSERVATION, schedule) : null;
		}
		const headingText = heading?.textContent?.trim();
		if (headingText) title = routeDocumentTitle(headingText);
		if (env.getTitle() !== title) env.setTitle(title);
	};

	const stopStructure = env.observe(env.main, ROUTE_STRUCTURE_OBSERVATION, schedule);

	return {
		sync,
		stop: () => {
			if (stopped) return;
			stopped = true;
			if (frame !== null) env.cancelFrame(frame);
			frame = null;
			stopStructure();
			stopHeading?.();
			stopHeading = null;
		},
	};
}
