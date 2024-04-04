import { AssetDetailType, DateType, OwnerType, ProfileType } from './types';

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
	return `${amount.toFixed(4)}`;
}

export function formatCount(count: string): string {
	if (count.includes('.')) {
		let parts = count.split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return parts.join('.');
	} else {
		return count.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	}
}

export function formatPercentage(percentage: number): string {
	return `${(percentage * 100).toFixed(2).toString()}%`;
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

export function getOwners(asset: AssetDetailType, profiles: ProfileType[] | null): OwnerType[] | null {
	if (asset && asset.state) {
		const balances: any = Object.keys(asset.state.balances).map((address: string) => {
			return Number(asset.state.balances[address]);
		});
		const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);

		return Object.keys(asset.state.balances).map((address: string) => {
			return {
				address: address,
				ownerQuantity: Number(asset.state.balances[address]),
				ownerPercentage: Number(asset.state.balances[address]) / totalBalance,
				profile: profiles ? profiles.find((profile: ProfileType) => profile.walletAddress === address) : null,
			};
		});
	}
	return null;
}
