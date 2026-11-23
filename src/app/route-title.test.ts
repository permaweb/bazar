import { describe, expect, it } from 'vitest';

import {
	DEFAULT_DOCUMENT_TITLE,
	ROUTE_HEADING_OBSERVATION,
	ROUTE_STRUCTURE_OBSERVATION,
	routeDocumentTitle,
	trackRouteDocumentTitle,
} from './route-title';

type Heading = { textContent: string | null };

function routeHarness(initialHeading: Heading | null = null) {
	let heading = initialHeading;
	const queries = { count: 0 };
	const titles: string[] = [];
	let title = 'Previous route — Bazar';
	const observers: { target: unknown; options: MutationObserverInit; onMutation: () => void; live: boolean }[] = [];
	const frames = new Map<number, () => void>();
	let nextFrame = 1;
	const main = {
		querySelector: (selector: string) => {
			expect(selector).toBe('h1');
			queries.count += 1;
			return heading;
		},
	} as unknown as Node & Pick<ParentNode, 'querySelector'>;
	const tracker = trackRouteDocumentTitle({
		main,
		getTitle: () => title,
		setTitle: (next) => {
			title = next;
			titles.push(next);
		},
		observe: (target, options, onMutation) => {
			const entry = { target, options, onMutation, live: true };
			observers.push(entry);
			return () => {
				entry.live = false;
			};
		},
		requestFrame: (callback) => {
			const id = nextFrame++;
			frames.set(id, callback);
			return id;
		},
		cancelFrame: (id) => {
			frames.delete(id);
		},
	});
	const liveObservers = (target: unknown) => observers.filter((entry) => entry.live && entry.target === target);
	return {
		main,
		tracker,
		queries,
		titles,
		frames,
		get title() {
			return title;
		},
		setHeading(next: Heading | null) {
			heading = next;
		},
		liveObservers,
		/** Deliver a mutation to every live observer of `target`. */
		mutate(target: unknown) {
			for (const entry of liveObservers(target)) entry.onMutation();
		},
		flushFrames() {
			const pending = [...frames.values()];
			frames.clear();
			for (const callback of pending) callback();
		},
	};
}

describe('routeDocumentTitle', () => {
	it('names the route after its heading and falls back to the site title', () => {
		expect(routeDocumentTitle('catsun')).toBe('catsun — Bazar');
		expect(routeDocumentTitle('  Alice on Arweave \n')).toBe('Alice on Arweave — Bazar');
		expect(routeDocumentTitle('')).toBe(DEFAULT_DOCUMENT_TITLE);
		expect(routeDocumentTitle('   ')).toBe(DEFAULT_DOCUMENT_TITLE);
		expect(routeDocumentTitle(null)).toBe(DEFAULT_DOCUMENT_TITLE);
		expect(routeDocumentTitle(undefined)).toBe(DEFAULT_DOCUMENT_TITLE);
	});
});

describe('route document title tracking', () => {
	it('uses the site title until the route renders a heading', () => {
		const route = routeHarness();
		route.tracker.sync();
		expect(route.title).toBe(DEFAULT_DOCUMENT_TITLE);
		route.setHeading({ textContent: 'catsun' });
		route.mutate(route.main);
		route.flushFrames();
		expect(route.title).toBe('catsun — Bazar');
	});

	it('follows a loading heading that is replaced by the loaded page heading', () => {
		const loading = { textContent: 'Collection' };
		const route = routeHarness(loading);
		route.tracker.sync();
		expect(route.title).toBe('Collection — Bazar');
		expect(route.liveObservers(loading)).toHaveLength(1);

		// React reuses the routed <section> and swaps its children, so the new h1 arrives deep in main.
		const loaded = { textContent: 'Atomic Cats' };
		route.setHeading(loaded);
		route.mutate(route.main);
		route.flushFrames();

		expect(route.title).toBe('Atomic Cats — Bazar');
		expect(route.liveObservers(loading)).toHaveLength(0);
		expect(route.liveObservers(loaded)).toHaveLength(1);
	});

	it('follows heading text that changes in place, such as a short address becoming a name', () => {
		const heading = { textContent: 'abcdef…wxyz' };
		const route = routeHarness(heading);
		route.tracker.sync();
		expect(route.title).toBe('abcdef…wxyz — Bazar');

		heading.textContent = 'Alice on Arweave';
		route.mutate(heading);
		route.flushFrames();
		expect(route.title).toBe('Alice on Arweave — Bazar');
	});

	it('keeps the last heading title while the heading is briefly empty', () => {
		const heading = { textContent: 'catsun' };
		const route = routeHarness(heading);
		route.tracker.sync();
		heading.textContent = '';
		route.mutate(heading);
		route.flushFrames();
		expect(route.title).toBe('catsun — Bazar');
	});

	it('never watches text across the whole route, only structure there and text in the heading', () => {
		const heading = { textContent: 'catsun' };
		const route = routeHarness(heading);
		route.tracker.sync();
		const [structure] = route.liveObservers(route.main);
		expect(structure.options).toEqual(ROUTE_STRUCTURE_OBSERVATION);
		expect(structure.options.characterData).toBeUndefined();
		expect(route.liveObservers(heading)[0].options).toEqual(ROUTE_HEADING_OBSERVATION);
	});

	it('coalesces a burst of progressive card mutations into one heading read and no title rewrite', () => {
		const route = routeHarness({ textContent: 'catsun' });
		route.tracker.sync();
		const queriesAfterSync = route.queries.count;
		const writesAfterSync = route.titles.length;

		for (let index = 0; index < 50; index += 1) route.mutate(route.main);
		expect(route.frames.size).toBe(1);
		route.flushFrames();

		expect(route.queries.count).toBe(queriesAfterSync + 1);
		expect(route.titles).toHaveLength(writesAfterSync);
		expect(route.title).toBe('catsun — Bazar');
	});

	it('writes the title only when it changes', () => {
		const route = routeHarness({ textContent: 'catsun' });
		route.tracker.sync();
		route.tracker.sync();
		route.mutate(route.main);
		route.flushFrames();
		expect(route.titles).toEqual(['catsun — Bazar']);
	});

	it('disconnects every observer and drops a pending frame when the route ends', () => {
		const heading = { textContent: 'catsun' };
		const route = routeHarness(heading);
		route.tracker.sync();
		route.mutate(route.main);
		expect(route.frames.size).toBe(1);

		route.tracker.stop();

		expect(route.frames.size).toBe(0);
		expect(route.liveObservers(route.main)).toHaveLength(0);
		expect(route.liveObservers(heading)).toHaveLength(0);
		route.setHeading({ textContent: 'Next route' });
		route.tracker.sync();
		expect(route.title).toBe('catsun — Bazar');
	});
});
