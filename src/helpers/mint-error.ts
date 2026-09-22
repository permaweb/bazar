export function mintErrorMessage(error: unknown) {
	const value = error instanceof Error ? error.message : String(error);
	const friendly: Record<string, string> = {
		'mint-name-invalid': 'Enter a name between 1 and 80 characters.',
		'mint-description-invalid': 'Keep the description under 600 characters.',
		'mint-file-required': 'Choose an image, MP3, or WAV file to continue.',
		'mint-file-type-unsupported': 'Use a PNG, JPG, WebP, GIF, MP3, or WAV file.',
		'mint-file-size-invalid': 'Use an image up to 10 MB, or an MP3/WAV file up to 100 MB.',
		'mint-artwork-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image for album artwork.',
		'mint-artwork-size-invalid': 'Choose album artwork no larger than 10 MB.',
		'mint-artwork-audio-only': 'Album artwork can only be attached to an MP3 or WAV asset.',
		'mint-logo-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image for the token logo.',
		'mint-logo-size-invalid': 'Choose a token logo no larger than 10 MB.',
		'mint-ticker-invalid': 'Enter a token ticker between 1 and 32 characters.',
		'mint-supply-invalid': 'Enter a positive whole-number token supply.',
		'mint-supply-too-large': 'Token supply exceeds the maximum allowed.',
		'mint-denomination-invalid': 'Enter decimal places from 0 to 255.',
		'mint-insufficient-balance': 'This wallet does not have enough AR for the required Arweave transaction(s).',
		'mint-high-cost-confirmation-required': 'Review and approve the unusually high network cost before minting.',
		'wallet-sign-unavailable': 'Connect an Arweave wallet that can sign transactions.',
		'wallet-account-changed': 'The connected wallet changed. Reconnect the original wallet and try again.',
		'mint-draft-wallet-mismatch': 'Reconnect the wallet that uploaded this media to finish minting it.',
		'mint-media-invalid': 'The earlier media upload is empty, too large, or unavailable in its original form.',
		'mint-udl-license-id-invalid': 'Enter a valid 43-character UDL transaction ID.',
		'mint-udl-access-fee-invalid': 'Enter a UDL access fee greater than zero.',
		'mint-udl-fee-invalid': 'Enter a UDL license fee greater than zero.',
		'mint-udl-share-invalid': 'Enter a UDL revenue share between 0 and 100 percent.',
		'mint-udl-expiry-invalid': 'Enter a whole number of years for the UDL license term.',
	};
	if (value.startsWith('mint-media-unavailable-')) {
		return 'The earlier media upload is not available through this gateway yet. Try finishing the mint later.';
	}
	return friendly[value] ?? value.replaceAll('-', ' ');
}
