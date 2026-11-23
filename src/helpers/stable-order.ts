/** A display order that holds still while the data behind it streams in. */
export type StableOrder<Key extends string = string> = {
	/** The sort or view the order was ranked for; a different key re-ranks immediately. */
	key: Key;
	settled: boolean;
	ids: readonly string[];
};

/**
 * Keep a grid or list in a stable order while it loads. The first ranked order is kept; arrivals while
 * loading are appended and refreshed items update in place. The order re-ranks only when the viewer picks
 * another sort (a new key) or once loading settles. An item that arrives after the order settled (discovery
 * can keep streaming after the first pass) is merged into its ranked place, after the settled item that
 * precedes it in the ranking, so only the items after it move.
 *
 * Returns `previous` itself when nothing changed, so callers can store the result with a render-phase
 * update that converges after one extra render.
 */
export function nextStableOrder<Key extends string>(
	previous: StableOrder<Key> | undefined,
	rankedIds: readonly string[],
	key: Key,
	settled: boolean
): StableOrder<Key> {
	if (!previous || previous.key !== key || (settled && !previous.settled)) {
		return { key, settled, ids: [...rankedIds] };
	}
	const present = new Set(rankedIds);
	const retained = previous.ids.filter((id) => present.has(id));
	const known = new Set(retained);
	let ids: string[];
	if (settled && previous.settled) {
		// Place each newcomer right after the retained item that precedes it in the ranking.
		const leading: string[] = [];
		const following = new Map<string, string[]>();
		let anchor: string | undefined;
		for (const id of rankedIds) {
			if (known.has(id)) anchor = id;
			else if (anchor === undefined) leading.push(id);
			else following.set(anchor, [...(following.get(anchor) ?? []), id]);
		}
		ids = [...leading, ...retained.flatMap((id) => [id, ...(following.get(id) ?? [])])];
	} else {
		ids = [...retained, ...rankedIds.filter((id) => !known.has(id))];
	}
	if (
		previous.settled === settled &&
		ids.length === previous.ids.length &&
		ids.every((id, index) => id === previous.ids[index])
	)
		return previous;
	return { key, settled, ids };
}

/** The items in `ids` order; an id without a current item is skipped. */
export function applyStableOrder<T>(items: readonly T[], ids: readonly string[], idOf: (item: T) => string): T[] {
	const byId = new Map(items.map((item) => [idOf(item), item]));
	return ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as T] : []));
}
