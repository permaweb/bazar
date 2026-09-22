export function winstonToAr(value: string) {
	const raw = BigInt(value);
	const whole = raw / 1_000_000_000_000n;
	const fraction = (raw % 1_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '');
	return fraction ? `${whole.toLocaleString()}.${fraction}` : whole.toLocaleString();
}

export function arToWinston(value: string) {
	if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || Number(value) <= 0)
		throw new Error('Enter a positive AR amount.');
	const [whole, decimals = ''] = value.split('.');
	return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}

// Plain decimal AR amount without locale grouping, for inputs, quotes, and exact comparisons.
export function winstonToArDecimal(value: string) {
	const raw = BigInt(value);
	const whole = raw / 1_000_000_000_000n;
	const fraction = (raw % 1_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '');
	return fraction ? `${whole}.${fraction}` : whole.toString();
}
