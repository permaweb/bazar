import { createDataItemSigner, message, result } from '@permaweb/aoconnect';

import { AO } from 'helpers/config';
import { VouchType } from 'helpers/types';

const VOUCHER_WHITELIST = {
	// Vouch-X
	'Ax_uXyLQBPZSQ15movzv9-O1mDo30khslqN64qD27Z8': true,
	// Vouch-Gitcoin-Passport
	k6p1MtqYhQQOuTSfN8gH7sQ78zlHavt8dCDL88btn9s: true,
	// Vouch-AO-Balance
	QeXDjjxcui7W2xU08zOlnFwBlbiID4sACpi0tSS3VgY: true,
	// Vouch-wAR-Stake
	'3y0YE11i21hpP8UY0Z1AVhtPoJD4V_AbEBx-g0j9wRc': true,
};

export async function getVouch(args: { address: string; wallet: any }): Promise<VouchType> {
	const cacheKey = `vouch_${args.address}`;
	const cachedResult = localStorage.getItem(cacheKey);
	if (cachedResult) {
		if (JSON.parse(cachedResult).score >= 5) {
			return JSON.parse(cachedResult);
		}
	}

	const messageId = await message({
		process: AO.vouch,
		signer: createDataItemSigner(args.wallet),
		tags: [
			{ name: 'Action', value: 'Get-Vouches' },
			{ name: 'ID', value: args.address },
		],
	});

	const { Messages } = await result({ message: messageId, process: AO.vouch });
	let score = 0;

	for (let i = 0; i < Messages.length; i++) {
		let data = JSON.parse(Messages[i].Data);
		let vouchers = data['Vouchers'];
		if (vouchers == null) {
			return { score: 0, isVouched: false };
		}
		for (const [key, vouch] of Object.entries(vouchers)) {
			if (VOUCHER_WHITELIST[key]) {
				let vouchFor = vouch['Vouch-For'];
				if (vouchFor === args.address) {
					let valueStr = vouch['Value'].match(/[\d.]+(?=-USD)/);
					let value = valueStr ? parseFloat(valueStr[0]) : null;
					if (value !== null) {
						score += value;
					}
				}
			}
		}
	}

	const r = { score, isVouched: score >= 5 };
	localStorage.setItem(cacheKey, JSON.stringify(r));
	return r;
}
