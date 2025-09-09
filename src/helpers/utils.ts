import { RegistryProfileType } from '@permaweb/aoprofile';

import {
	AssetDetailType,
	AssetOrderType,
	AssetSortType,
	DateType,
	EntryOrderType,
	OrderbookEntryType,
	OwnerType,
	StampsType,
} from './types';

declare const InstallTrigger: any;

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
	if (count === '0' || !Number(count)) return '0';

	if (count.includes('.')) {
		let parts = count.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

		// Find the position of the last non-zero digit within the first 6 decimal places
		let index = 0;
		for (let i = 0; i < Math.min(parts[1].length, 12); i++) {
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

			// If the decimal part is longer than 4 digits, truncate to 4 digits
			if (parts[1].length > 4 && parts[1].substring(0, 4) !== '0000') {
				parts[1] = parts[1].substring(0, 4);
			}
		}

		return parts.join('.');
	} else {
		return count.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}
}

export function formatPercentage(percentage: any) {
	if (isNaN(percentage)) return '0%';

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

export function formatDate(dateArg: string | number | null, dateType: DateType, fullTime?: boolean) {
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

	return fullTime
		? `${date.toLocaleString('default', { month: 'long' })} ${date.getDate()}, ${date.getUTCFullYear()} ${
				date.getHours() % 12 || 12
		  }:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')} ${
				date.getHours() >= 12 ? 'PM' : 'AM'
		  }`
		: `${date.toLocaleString('default', { month: 'long' })} ${date.getDate()}, ${date.getUTCFullYear()}`;
}

export function getRelativeDate(timestamp: number) {
	if (!timestamp) return '-';
	const currentDate = new Date();
	const inputDate = new Date(timestamp);

	const timeDifference: number = currentDate.getTime() - inputDate.getTime();
	const secondsDifference = Math.floor(timeDifference / 1000);
	const minutesDifference = Math.floor(secondsDifference / 60);
	const hoursDifference = Math.floor(minutesDifference / 60);
	const daysDifference = Math.floor(hoursDifference / 24);
	const monthsDifference = Math.floor(daysDifference / 30.44); // Average days in a month
	const yearsDifference = Math.floor(monthsDifference / 12);

	if (yearsDifference > 0) {
		return `${yearsDifference} year${yearsDifference > 1 ? 's' : ''} ago`;
	} else if (monthsDifference > 0) {
		return `${monthsDifference} month${monthsDifference > 1 ? 's' : ''} ago`;
	} else if (daysDifference > 0) {
		return `${daysDifference} day${daysDifference > 1 ? 's' : ''} ago`;
	} else if (hoursDifference > 0) {
		return `${hoursDifference} hour${hoursDifference > 1 ? 's' : ''} ago`;
	} else if (minutesDifference > 0) {
		return `${minutesDifference} minute${minutesDifference > 1 ? 's' : ''} ago`;
	} else {
		return `${secondsDifference} second${secondsDifference !== 1 ? 's' : ''} ago`;
	}
}

export function formatRequiredField(field: string) {
	return `${field} *`;
}

export function splitTagValue(tag: any) {
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

export function sortByAssetOrders(
	assets: AssetDetailType[],
	sortType: AssetSortType,
	stamps: StampsType
): AssetDetailType[] {
	const getSortKey = (asset: AssetDetailType): number => {
		if (!asset.orderbook?.orders || asset.orderbook?.orders.length === 0) return Infinity;
		return Number(sortOrders(asset.orderbook?.orders, sortType)[0].price);
	};

	const getDateKey = (asset: AssetDetailType): number => {
		if (!asset.orderbook?.orders || asset.orderbook?.orders.length === 0) return 0;
		return new Date(asset.orderbook?.orders[0].dateCreated).getTime();
	};

	const getStampKey = (asset: AssetDetailType): number => {
		if (!asset.data.id) return -1;
		return stamps?.[asset?.data.id]?.total ?? -1;
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
		case 'stamps':
			direction = 1;
			break;
		default:
			direction = 1;
	}

	if (sortType === 'stamps') {
		return assets.sort((a, b) => {
			const stampA = getStampKey(a);
			const stampB = getStampKey(b);

			if (stampA !== stampB) {
				return direction * (stampB - stampA);
			}

			return getDateKey(b) - getDateKey(a);
		});
	}

	let assetsWithOrders = assets.filter((asset) => asset.orderbook?.orders && asset.orderbook?.orders.length > 0);
	const assetsWithoutOrders = assets.filter(
		(asset) => !asset.orderbook?.orders || asset.orderbook?.orders.length === 0
	);

	assetsWithOrders.sort((a, b) => {
		if (sortType === 'recently-listed') {
			return direction * (getDateKey(b) - getDateKey(a));
		} else {
			return direction * (getSortKey(a) - getSortKey(b));
		}
	});

	return [...assetsWithOrders, ...assetsWithoutOrders];
}

export function sortOrderbookEntries(
	entries: OrderbookEntryType[],
	sortType: AssetSortType,
	stamps: StampsType
): OrderbookEntryType[] {
	const getSortKey = (entry: OrderbookEntryType): number => {
		if (!entry.Orders || entry.Orders.length === 0) return Infinity;
		return Number(entry.Orders[0].Price);
	};

	const getDateKey = (entry: OrderbookEntryType): number => {
		if (!entry.Orders || entry.Orders.length === 0) return 0;
		return new Date(entry.Orders[0].DateCreated).getTime();
	};

	const getStampKey = (entry: OrderbookEntryType): number => {
		if (!stamps || !entry.Pair || entry.Pair.length === 0) return -1;
		return stamps[entry.Pair[0]]?.total ?? -1;
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
		case 'stamps':
			direction = 1;
			break;
		default:
			direction = 1;
	}

	if (sortType === 'stamps') {
		return entries.sort((a, b) => {
			const stampA = getStampKey(a);
			const stampB = getStampKey(b);

			if (stampA !== stampB) {
				return direction * (stampB - stampA);
			}

			return getDateKey(b) - getDateKey(a);
		});
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

export function getTotalTokenBalance(
	tokenBalances: { profileBalance: number | string; walletBalance: number | string } | null
) {
	if (!tokenBalances) return null;

	let total = 0;

	if (tokenBalances.profileBalance !== null) total += tokenBalances.profileBalance;
	if (tokenBalances.walletBalance !== null) total += tokenBalances.walletBalance;

	return total;
}

export function isFirefox(): boolean {
	return typeof InstallTrigger !== 'undefined';
}

export function reverseDenomination(number: number) {
	let count = 0;

	while (number > 0 && number % 10 === 0) {
		count++;
		number /= 10;
	}

	return count;
}

export function cleanTagValue(value: string) {
	let updatedValue: string;
	updatedValue = value.replace(/\[|\]/g, '');
	return updatedValue;
}

export function checkEqualObjects(obj1: object, obj2: object): boolean {
	if (!obj1 || !obj2) return false;

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	if (keys1.length !== keys2.length) {
		return false;
	}

	for (const key of keys1) {
		if (obj1[key] !== obj2[key]) {
			return false;
		}
	}

	return true;
}
