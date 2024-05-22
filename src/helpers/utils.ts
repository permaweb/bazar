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
	const formattedAddress = address.substring(0, 5) + '...' + address.substring(36, address.length - 1);
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

export function formatARAmount(amount: number) {
	return `${amount.toFixed(2)}`;
}

export function formatCount(count: string): string {
	if (count.includes('.')) {
		let parts = count.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

		// Find the first non-zero digit in the decimal part
		let index = parts[1].length;
		for (let i = 0; i < parts[1].length; i++) {
			if (parts[1][i] !== '0') {
				index = i + 1;
				break;
			}
		}
		if (index === parts[1].length && parts[1][parts[1].length - 1] === '0') {
			parts[1] = '00';
		} else {
			parts[1] = parts[1].substring(0, index);
			parts[1] = parts[1].padEnd(index, '0');
		}

		return parts.join('.');
	} else {
		return count.replace(/\B(?=(\d{3})+(?!\d))/g, ','); //  + '.00'
	}
}

export function formatPercentage(percentage: number): string {
	let multiplied = percentage * 100;
	let decimalPart = multiplied.toString().split('.')[1];

	// If there is no decimal part, return the integer value
	if (!decimalPart) {
		return `${multiplied.toFixed(0)}%`;
	}

	// Check the length of the decimal part
	if (decimalPart.length >= 4) {
		return `${Math.round(multiplied)}%`;
	}

	// Return the percentage with appropriate decimals
	return `${multiplied.toFixed(decimalPart.length)}%`;
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

export function splitTagValue(tag: string) {
	return tag.split('-').join(' ');
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
		depositTxId: order.DepositTxId,
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

	const direction = sortType === 'high-to-low' ? -1 : 1;

	const assetsWithOrders = assets.filter((asset) => asset.orders && asset.orders.length > 0);
	const assetsWithoutOrders = assets.filter((asset) => !asset.orders || asset.orders.length === 0);

	assetsWithOrders.sort((a, b) => {
		return direction * (getSortKey(a) - getSortKey(b));
	});

	return [...assetsWithOrders, ...assetsWithoutOrders];
}

export function sortOrderbookEntries(entries: OrderbookEntryType[], sortType: AssetSortType): OrderbookEntryType[] {
	const getSortKey = (entry: OrderbookEntryType): number => {
		if (!entry.Orders || entry.Orders.length === 0) return Infinity;
		return Number(entry.Orders[0].Price);
	};

	const direction = sortType === 'high-to-low' ? -1 : 1;

	const entriesWithOrders = entries.filter((entry) => entry.Orders && entry.Orders.length > 0);
	const entriesWithoutOrders = entries.filter((entry) => !entry.Orders || entry.Orders.length === 0);

	entriesWithOrders.sort((a, b) => {
		return direction * (getSortKey(a) - getSortKey(b));
	});

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
