import React from 'react';

export type TokenPricePoint = {
	id: string;
	timestamp: number;
	value: string;
};

export function tokenPricePolyline(points: TokenPricePoint[], width = 640, height = 180) {
	if (!points.length) return '';
	const values = points.map((point) => BigInt(point.value));
	const minimum = values.reduce((current, value) => (value < current ? value : current));
	const maximum = values.reduce((current, value) => (value > current ? value : current));
	const range = maximum - minimum;
	return values
		.map((value, index) => {
			const x = points.length === 1 ? width / 2 : (index * width) / (points.length - 1);
			const normalized = range === 0n ? 500n : ((value - minimum) * 1_000n) / range;
			const y = height - (Number(normalized) / 1_000) * height;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(' ');
}

export function TokenPriceChart({
	points,
	ticker,
	loading,
	error,
	formatValue,
}: {
	points: TokenPricePoint[];
	ticker: string;
	loading: boolean;
	error: string | null;
	formatValue(value: string): string;
}) {
	const ordered = [...points].sort(
		(left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id)
	);
	const values = ordered.map((point) => BigInt(point.value));
	const low = values.length
		? values.reduce((current, value) => (value < current ? value : current)).toString()
		: null;
	const high = values.length
		? values.reduce((current, value) => (value > current ? value : current)).toString()
		: null;
	const latest = ordered.at(-1)?.value ?? null;
	const polyline = tokenPricePolyline(ordered);

	return (
		<section className="token-price-chart" aria-busy={loading} aria-label={`${ticker} indexed ask history`}>
			<div className="token-price-chart-heading">
				<div>
					<p className="eyebrow">Indexed listings</p>
					<h2>Ask history</h2>
				</div>
				{latest ? (
					<div className="token-price-latest">
						<span>Latest ask</span>
						<strong>{formatValue(latest)}</strong>
					</div>
				) : null}
			</div>
			{ordered.length ? (
				<>
					<div className="token-price-plot">
						<svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 640 180">
							<line x1="0" x2="640" y1="0" y2="0" />
							<line x1="0" x2="640" y1="90" y2="90" />
							<line x1="0" x2="640" y1="180" y2="180" />
							{ordered.length === 1 ? <circle cx="320" cy="90" r="4" /> : <polyline points={polyline} />}
						</svg>
					</div>
					<div className="token-price-range">
						<span>Low {low ? formatValue(low) : '—'}</span>
						<span>
							{ordered.length.toLocaleString()} indexed {ordered.length === 1 ? 'ask' : 'asks'}
						</span>
						<span>High {high ? formatValue(high) : '—'}</span>
					</div>
				</>
			) : loading ? (
				<p className="token-price-empty">Reading indexed asks…</p>
			) : error ? (
				<p className="token-price-empty">Ask history is temporarily unavailable.</p>
			) : (
				<p className="token-price-empty">No indexed asks yet.</p>
			)}
			<p className="market-note">Listing submissions only. This is not executed trade-price history.</p>
		</section>
	);
}
