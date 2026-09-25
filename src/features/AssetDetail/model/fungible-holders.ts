import { type AssetState, isBalanceIdentity, liveOrdersOfAsset } from 'api/marketplace';

import { formatMessage } from 'helpers/i18n';

import type { AssetDetailMessages } from '../messages';

export type FungibleHolder = {
	address: string;
	liquid: string;
	listed: string;
	total: string;
};

export function fungibleHolders(state: AssetState): FungibleHolder[] {
	const listedByAddress = new Map<string, bigint>();
	for (const order of liveOrdersOfAsset(state)) {
		listedByAddress.set(order.creator, (listedByAddress.get(order.creator) ?? 0n) + BigInt(order.quantity));
	}

	const addresses = new Set([
		...Object.entries(state.balances)
			.filter(([address, balance]) => isBalanceIdentity(address) && BigInt(balance) > 0n)
			.map(([address]) => address),
		...listedByAddress.keys(),
	]);

	return [...addresses]
		.map((address) => {
			const liquid = BigInt(state.balances[address] ?? '0');
			const listed = listedByAddress.get(address) ?? 0n;
			return {
				address,
				liquid: liquid.toString(),
				listed: listed.toString(),
				total: (liquid + listed).toString(),
			};
		})
		.sort((left, right) => {
			const difference = BigInt(right.total) - BigInt(left.total);
			if (difference !== 0n) return difference < 0n ? -1 : 1;
			return left.address.localeCompare(right.address);
		});
}

export function fungibleHoldingPercentage(balance: string, totalSupply: string) {
	try {
		const held = BigInt(balance);
		const supply = BigInt(totalSupply);
		if (held <= 0n || supply <= 0n) return '—';
		const hundredths = (held * 10_000n + supply / 2n) / supply;
		if (hundredths === 0n) return '<0.01%';
		const whole = hundredths / 100n;
		const fraction = (hundredths % 100n).toString().padStart(2, '0').replace(/0+$/, '');
		return `${whole.toString()}${fraction ? `.${fraction}` : ''}%`;
	} catch {
		return '—';
	}
}

export type FungibleHolderChartSlice = Omit<FungibleHolder, 'address'> & {
	address?: string;
	holderCount: number;
	key: string;
	label: string;
};

export function fungibleHolderChartSlices(
	holders: FungibleHolder[],
	messages: AssetDetailMessages,
	maximumSlices = 12
): FungibleHolderChartSlice[] {
	const limit = Math.max(2, maximumSlices);
	if (holders.length <= limit) {
		return holders.map((holder) => ({
			...holder,
			holderCount: 1,
			key: holder.address,
			label: holder.address,
		}));
	}

	const visible = holders.slice(0, limit - 1).map((holder) => ({
		...holder,
		holderCount: 1,
		key: holder.address,
		label: holder.address,
	}));
	const remainder = holders.slice(limit - 1).reduce(
		(total, holder) => ({
			liquid: total.liquid + BigInt(holder.liquid),
			listed: total.listed + BigInt(holder.listed),
			total: total.total + BigInt(holder.total),
		}),
		{ liquid: 0n, listed: 0n, total: 0n }
	);
	const holderCount = holders.length - visible.length;
	return [
		...visible,
		{
			holderCount,
			key: 'other-holders',
			label: formatMessage(messages.holderChartOtherHolders, { count: holderCount.toLocaleString() }),
			liquid: remainder.liquid.toString(),
			listed: remainder.listed.toString(),
			total: remainder.total.toString(),
		},
	];
}

export function fungibleOfferedPercentage(listed: string, total: string) {
	try {
		if (BigInt(total) <= 0n) return '—';
		if (BigInt(listed) <= 0n) return '0%';
		return fungibleHoldingPercentage(listed, total);
	} catch {
		return '—';
	}
}

export const HOLDER_CHART_COLORS = [
	'var(--positive-text)',
	'var(--event-purple)',
	'var(--event-orange)',
	'var(--event-blue)',
	'var(--event-pink)',
	'var(--accent)',
	'var(--warning-text)',
	'var(--muted-subtle)',
];

export function holderChartPercentage(value: bigint, total: bigint) {
	if (value <= 0n || total <= 0n) return 0;
	return Number((value * 1_000_000n) / total) / 10_000;
}
