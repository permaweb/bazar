type FixtureEdge = { cursor: string; node: { id: string; block?: unknown } };

/** Replay inline fixture metadata as a separate by-ID response on the same index. */
export function withIndexedActivityBlocks(fetchPage: typeof fetch): typeof fetch {
	const positionsByIndex = new Map<string, Map<string, FixtureEdge>>();
	return async (input, init) => {
		const endpoint = String(input);
		const { query, variables } = JSON.parse(String(init?.body));
		let positions = positionsByIndex.get(endpoint);
		if (!positions) positionsByIndex.set(endpoint, (positions = new Map()));
		if (query.includes('query TransactionBlocks(')) {
			const byIds = (ids: string[]) => ({
				edges: [...positions.values()].filter(({ node }) => ids.includes(node.id)),
			});
			const data = variables.ids
				? { transactions: byIds(variables.ids) }
				: Object.fromEntries(
						Object.keys(variables)
							.filter((key) => /^ids\d+$/.test(key))
							.map((key) => [`batch${key.slice(3)}`, byIds(variables[key])])
				  );
			return Response.json({ data });
		}
		const response = await fetchPage(input, init);
		if (!response.ok) return response;
		const payload = await response.json();
		const edges: FixtureEdge[] | undefined = payload.data?.transactions?.edges;
		if (edges) {
			payload.data.transactions.edges = edges.map(({ cursor, node: { block, ...node } }) => {
				positions.set(JSON.stringify([node.id, cursor]), {
					cursor,
					node: { id: node.id, block: block ?? null },
				});
				return { cursor, node };
			});
		}
		return Response.json(payload);
	};
}
