const RAW_ACCOUNT = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const HOST_ACCOUNT = /^uri-did-ar-([a-z0-9-]{43})([0-9a-z]{9})$/;

export function toHostAccount(raw43: string): string | null {
	if (raw43.length !== 43 || !RAW_ACCOUNT.test(raw43)) return null;
	let bits = 0;
	for (const character of raw43) {
		bits = bits * 2 + (/[A-Z_]/.test(character) ? 1 : 0);
	}
	return `uri-did-ar-${raw43.toLowerCase().replaceAll('_', '-')}${(bits * 8).toString(36).padStart(9, '0')}`;
}

export function fromHostAccount(host: string): string | null {
	if (host.length !== 63) return null;
	const match = HOST_ACCOUNT.exec(host);
	if (!match) return null;
	const value = Number.parseInt(match[2], 36);
	if (value >= 2 ** 46 || value % 8 !== 0) return null;
	const bits = value / 8;
	let raw = '';
	for (let index = 0; index < 43; index += 1) {
		const character = match[1][index];
		const bit = Math.floor(bits / 2 ** (42 - index)) % 2;
		if (bit && /[0-9]/.test(character)) return null;
		raw += bit ? (character === '-' ? '_' : character.toUpperCase()) : character;
	}
	return RAW_ACCOUNT.test(raw) ? raw : null;
}

export const ETHEREUM_HOST_ACCOUNT = /^uri-did-pkh-eip155-1-(0x[0-9a-f]{40})$/;

export function accountAddress(account: string): string {
	return fromHostAccount(account) ?? account;
}

export function displayAccount(account: string): string {
	return ETHEREUM_HOST_ACCOUNT.exec(account)?.[1] ?? accountAddress(account);
}

export function sameAccount(left: unknown, right: unknown): boolean {
	return (
		typeof left === 'string' &&
		typeof right === 'string' &&
		left !== '' &&
		accountAddress(left) === accountAddress(right)
	);
}
