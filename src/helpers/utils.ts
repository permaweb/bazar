import {
	AssetDetailType,
	AssetOrderType,
	AssetSortType,
	DateType,
	EntryOrderType,
	OrderbookEntryType,
	OwnerType,
	RegistryProfileType,
} from './types';

export function checkValidAddress(address: string | null) {
	if (!address) return false;
	return /^[a-z0-9_-]{43}$/i.test(address);
}

export function formatAddress(address: string | null, wrap: boolean) {
	if (!address) return '';
	if (!checkValidAddress(address)) return address;
	const formattedAddress = address.substring(0, 5) + '...' + address.substring(36, address.length);
	return wrap ? `(${formattedAddress})` : formattedAddress;
}

export function getTagValue(list: { [key: string]: any }[], name: string): string {
	for (let i = 0; i < list.length; i++) {
		if (list[i]) {
			if (list[i]!.name === name) {
				return list[i]!.value as string;
			}
		}
	}
	return null;
}

export function formatCount(count: string): string {
	if (count.includes('.')) {
		let parts = count.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

		// Find the position of the last non-zero digit within the first 6 decimal places
		let index = 0;
		for (let i = 0; i < Math.min(parts[1].length, 6); i++) {
			if (parts[1][i] !== '0') {
				index = i + 1;
			}
		}

		if (index === 0) {
			// If all decimals are zeros, keep two decimal places
			parts[1] = '00';
		} else {
			// Otherwise, truncate to the last non-zero digit
			parts[1] = parts[1].substring(0, index);
		}

		return parts.join('.');
	} else {
		return count.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}
}

export function formatPercentage(percentage) {
	let multiplied = percentage * 100;
	let decimalPart = multiplied.toString().split('.')[1];

	if (!decimalPart) {
		return `${multiplied.toFixed(0)}%`;
	}

	if (decimalPart.length > 6 && decimalPart.substring(0, 6) === '000000') {
		return `${multiplied.toFixed(0)}%`;
	}

	let nonZeroIndex = decimalPart.length;
	for (let i = 0; i < decimalPart.length; i++) {
		if (decimalPart[i] !== '0') {
			nonZeroIndex = i + 1;
			break;
		}
	}

	return `${multiplied.toFixed(nonZeroIndex)}%`;
}

export function formatDate(dateArg: string | number | null, dateType: DateType) {
	if (!dateArg) {
		return null;
	}

	let date: Date | null = null;

	switch (dateType) {
		case 'iso':
			date = new Date(dateArg);
			break;
		case 'epoch':
			date = new Date(Number(dateArg));
			break;
		default:
			date = new Date(dateArg);
			break;
	}

	return `${date.toLocaleString('default', {
		month: 'long',
	})} ${date.getDate()}, ${date.getUTCFullYear()}`;
}

export function formatRequiredField(field: string) {
	return `${field} *`;
}

export function splitTagValue(tag) {
	let parts = tag.split('-');

	let lastPart = parts[parts.length - 1];
	if (!isNaN(lastPart)) {
		parts = parts.slice(0, -1).join(' ') + ': ' + lastPart;
	} else {
		parts = parts.join(' ');
	}

	return parts;
}

export function getTagDisplay(value: string) {
	let result = value.replace(/([A-Z])/g, ' $1').trim();
	result = result.charAt(0).toUpperCase() + result.slice(1);
	return result;
}

export function getOwners(asset: AssetDetailType, profiles: RegistryProfileType[] | null): OwnerType[] | null {
	if (asset && asset.state && asset.state.balances) {
		const balances: any = Object.keys(asset.state.balances).map((address: string) => {
			return Number(asset.state.balances[address]);
		});
		const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);

		return Object.keys(asset.state.balances).map((address: string) => {
			return {
				address: address,
				ownerQuantity: Number(asset.state.balances[address]),
				ownerPercentage: Number(asset.state.balances[address]) / totalBalance,
				profile: profiles ? profiles.find((profile: RegistryProfileType) => profile.id === address) : null,
			};
		});
	}
	return null;
}

export function getAssetOrderType(order: EntryOrderType, currency: string): AssetOrderType {
	let currentAssetOrder: AssetOrderType = {
		creator: order.Creator,
		dateCreated: order.DateCreated,
		id: order.Id,
		originalQuantity: order.OriginalQuantity,
		quantity: order.Quantity,
		token: order.Token,
		currency: currency,
	};

	if (order.Price) currentAssetOrder.price = order.Price;
	return currentAssetOrder;
}

export function sortOrders(orders: AssetOrderType[], sortType: AssetSortType) {
	const sortedOrders = orders.sort((a: AssetOrderType, b: AssetOrderType) => {
		switch (sortType) {
			case 'low-to-high':
				return a.price && b.price ? Number(a.price) - Number(b.price) : 0;
			case 'high-to-low':
				return a.price && b.price ? Number(b.price) - Number(a.price) : 0;
		}
	});
	return sortedOrders;
}

export function sortByAssetOrders(assets: AssetDetailType[], sortType: AssetSortType): AssetDetailType[] {
	const getSortKey = (asset: AssetDetailType): number => {
		if (!asset.orders || asset.orders.length === 0) return Infinity;
		return Number(sortOrders(asset.orders, sortType)[0].price);
	};

	const getDateKey = (asset: AssetDetailType): number => {
		if (!asset.orders || asset.orders.length === 0) return 0;
		return new Date(asset.orders[0].dateCreated).getTime();
	};

	let direction: number;

	switch (sortType) {
		case 'high-to-low':
			direction = -1;
			break;
		case 'low-to-high':
			direction = 1;
			break;
		case 'recently-listed':
			direction = -1;
			break;
		default:
			direction = 1;
	}

	let assetsWithOrders = assets.filter((asset) => asset.orders && asset.orders.length > 0);
	const assetsWithoutOrders = assets.filter((asset) => !asset.orders || asset.orders.length === 0);

	assetsWithOrders.sort((a, b) => {
		if (sortType === 'recently-listed') {
			return direction * (getDateKey(b) - getDateKey(a));
		} else {
			return direction * (getSortKey(a) - getSortKey(b));
		}
	});

	return [...assetsWithOrders, ...assetsWithoutOrders];
}

export function sortOrderbookEntries(entries: OrderbookEntryType[], sortType: AssetSortType): OrderbookEntryType[] {
	const getSortKey = (entry: OrderbookEntryType): number => {
		if (!entry.Orders || entry.Orders.length === 0) return Infinity;
		return Number(entry.Orders[0].Price);
	};

	const getDateKey = (entry: OrderbookEntryType): number => {
		if (!entry.Orders || entry.Orders.length === 0) return 0;
		return new Date(entry.Orders[0].DateCreated).getTime();
	};

	let direction: number;

	switch (sortType) {
		case 'high-to-low':
			direction = -1;
			break;
		case 'low-to-high':
			direction = 1;
			break;
		case 'recently-listed':
			direction = -1;
			break;
		default:
			direction = 1;
	}

	let entriesWithOrders = entries.filter((entry) => entry.Orders && entry.Orders.length > 0);
	const entriesWithoutOrders = entries.filter((entry) => !entry.Orders || entry.Orders.length === 0);

	entriesWithOrders.sort((a, b) => {
		if (sortType === 'recently-listed') {
			return direction * (getDateKey(b) - getDateKey(a));
		} else {
			return direction * (getSortKey(a) - getSortKey(b));
		}
	});

	if (sortType === 'recently-listed') {
		entriesWithOrders = entriesWithOrders.reverse();
	}

	return [...entriesWithOrders, ...entriesWithoutOrders];
}

export function getDataURLContentType(dataURL: string) {
	const result = dataURL.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
	return result ? result[1] : null;
}

export function getBase64Data(dataURL: string) {
	return dataURL.split(',')[1];
}

export function getByteSize(input: string | Buffer): number {
	let sizeInBytes: number;
	if (Buffer.isBuffer(input)) {
		sizeInBytes = input.length;
	} else if (typeof input === 'string') {
		sizeInBytes = Buffer.byteLength(input, 'utf-8');
	} else {
		throw new Error('Input must be a string or a Buffer');
	}

	return sizeInBytes;
}

export function getTotalTokenBalance(tokenBalances: { profileBalance: number; walletBalance: number } | null) {
	if (!tokenBalances) return null;
	const total = (tokenBalances.profileBalance || 0) + (tokenBalances.walletBalance || 0);
	return total;
}
