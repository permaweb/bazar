import { defineMessages } from 'helpers/i18n';

export const DISPATCH_MESSAGES = defineMessages({
	en: {
		dispatchEyebrow: 'Dispatch',
		dispatchUnknownTokenTitle: 'Unknown token',
		dispatchUnknownTokenDetail: 'The address in the URL is not a 43-character Arweave process ID.',
		dispatchTokenEyebrow: 'Dispatch fungible token',
		dispatchTokenIntro:
			'Send token amounts from a pasted holder list. Bazar converts them to atomic units for individual Arweave L1 transfers and saves progress locally so you can resume.',
		dispatchTokenLoading: 'Reading token state…',
		dispatchTokenUnreadableTitle: 'Token state not readable yet',
		dispatchTokenUnreadableDetail:
			'The token process state is not readable yet. A freshly minted token only becomes readable once the arweave-scheduler sequences its creation — around 20 minutes on mainnet. Retry once it has settled.',
		dispatchTokenRetry: 'Retry',
		dispatchTokenArtworkSubtitle: 'Arweave-native',
		dispatchTokenTicker: 'Ticker',
		dispatchTokenTotalSupply: 'Total supply',
		dispatchTokenDenomination: 'Denomination',
		dispatchTokenYourBalance: 'Your balance',
		dispatchTokenBalanceUnavailable: 'Unavailable',
		dispatchTokenConnectWallet: 'Connect wallet',
		dispatchTokenPageLink: 'View token page',
		/** Ticker fallback for an unnamed token, both in amounts and in the activity entry. */
		dispatchTokenFallbackTicker: 'tokens',
		dispatchActivityFallbackName: 'Token',
		dispatchArtworkFallbackTicker: 'TOKEN',

		dispatchHolderListLabel: 'Holder list',
		dispatchHolderListRecipients: 'Recipients',
		dispatchHolderListFormatLabel: 'Holder list format',
		// The format tooltip is one paragraph interrupted by inline <code> samples, so each run is its own message.
		dispatchHolderListFormatIntro: 'Paste a whole list into any field to autofill the rows. Accepts CSV — one',
		dispatchHolderListFormatPerLine: 'per line,',
		dispatchHolderListFormatComments: 'lines are comments — or JSON:',
		dispatchHolderListFormatOr: 'or',
		dispatchHolderListFormatQuantities: {
			one: 'Quantities are {ticker} amounts with up to {denomination} decimal place; one row per address. Use quoted JSON strings for fractional or very large quantities.',
			other: 'Quantities are {ticker} amounts with up to {denomination} decimal places; one row per address. Use quoted JSON strings for fractional or very large quantities.',
		},
		dispatchHolderRowAddressLabel: 'Recipient address, row {row}',
		dispatchHolderRowAddressPlaceholder: 'Arweave address (43 characters)',
		dispatchHolderRowQuantityLabel: 'Quantity in {ticker}, row {row}',
		dispatchHolderRowQuantityPlaceholder: 'Amount in {ticker}',
		dispatchHolderRowRemove: 'Remove recipient row {row}',
		dispatchHolderRowAdd: 'Add recipient',

		dispatchParsedRecipients: {
			one: '{count} recipient parsed',
			other: '{count} recipients parsed',
		},
		dispatchHolderListHint: 'Add rows, or paste a JSON/CSV list into any field to autofill',
		dispatchMoreErrors: '…and {count} more.',
		dispatchTableRecipient: 'Recipient',
		dispatchTableTokenAmount: 'Token amount',
		dispatchTableStatus: 'Status',
		dispatchSummaryRecipients: 'Recipients',
		dispatchSummaryTotalTokenAmount: 'Total token amount',
		dispatchSummaryTotalArCost: 'Total AR cost',
		dispatchArAmount: '{amount} AR',
		dispatchSignatureNotice: {
			one: 'Each recipient is one L1 transfer signed in your wallet ({count} signature, sent in batches of {batchSize}). Behind this form, each token amount is converted to atomic units. The AR quote includes network rewards only.',
			other: 'Each recipient is one L1 transfer signed in your wallet ({count} signatures, sent in batches of {batchSize}). Behind this form, each token amount is converted to atomic units. The AR quote includes network rewards only.',
		},
		dispatchCostWarningTitle: 'This dispatch costs more than 0.1 AR',
		dispatchCostWarningExpected: 'Expected',
		dispatchCostWarningSpend: 'in real AR spend',
		dispatchCostWarningHint: 'Approve the network quote to enable sending.',
		dispatchCostApproved: 'Approved',
		dispatchCostApprove: 'Approve quote',
		dispatchSubmitRunning: 'Dispatching…',
		dispatchSubmit: 'Sign and dispatch',
		dispatchSubmitConnectWallet: 'Connect wallet to dispatch',
		dispatchPermanenceNote:
			'Confirmed Arweave transfers are permanent. Review every address and quantity before signing.',

		dispatchPlanComplete: 'Dispatch complete',
		dispatchPlanRunning: 'Dispatching…',
		dispatchPlanSaved: 'Saved dispatch in progress',
		dispatchPlanSettled: '{settled} of {total} settled',
		dispatchPlanPosted: ' · {posted} posted, awaiting settlement',
		dispatchPlanStartedFrom: ' · started from {sender}',
		dispatchPlanWorking: 'Working…',
		dispatchPlanResume: 'Resume',
		dispatchPlanClear: 'Clear',
		dispatchPlanDiscard: 'Discard plan',
		dispatchPlanSenderMismatch: 'This dispatch was started from {sender}. Connect that wallet to resume it.',
		dispatchPlanSettlementNotice:
			'Settlement is not instant: the scheduler only sequences a transfer once it sits ~10 blocks below the network tip (~20 minutes). Leaving this page is safe — resume later and nothing will be re-sent.',
		dispatchPlanSettledTitle: 'All transfers settled',
		dispatchPlanSettledDetail: 'Every recipient balance has risen by its dispatched quantity.',

		dispatchRowStatusUnsent: 'Unsent',
		dispatchRowStatusPosted: 'Posted',
		dispatchRowStatusSettled: 'Settled',
		dispatchStartStatus: {
			one: 'Dispatching to {count} holder…',
			other: 'Dispatching to {count} holders…',
		},
		dispatchProgressStatus: '{settled} of {total} settled',

		dispatchErrorBalanceStateUnavailable:
			'The configured AO routes did not return a complete holder balance table. Bazar did not sign a transfer. Retry after complete state is available; any saved dispatch progress remains available.',
		dispatchErrorStateTimeout:
			'The configured AO routes did not return complete holder state within 45 seconds. No new transfer was signed; saved dispatch progress remains available.',
		dispatchErrorSettlementTimeout:
			'Timed out waiting for settlement. Nothing was lost: posted transfers stay posted — resume to continue watching without re-sending.',
		dispatchErrorWalletSignUnavailable: 'Connect an Arweave wallet extension that supports transaction signing.',
		dispatchErrorInsufficientFunds: 'Your AR balance cannot cover the transfer amounts plus network rewards.',
		dispatchErrorWalletAccountChanged:
			'The connected wallet changed mid-dispatch. Reconnect the wallet that started this dispatch and resume.',

		holderListEmpty: 'The holder list is empty.',
		holderListWithoutEntries: 'The holder list contains no entries.',
		holderListDuplicateAddresses: {
			one: 'Duplicate address — merge into one row each: {addresses}',
			other: 'Duplicate addresses — merge into one row each: {addresses}',
		},
		holderListInvalidJson:
			'Invalid JSON. Paste [{"address","quantity"}], [[address, quantity]], or {address: quantity}.',
		holderListInvalidJsonRoot: 'Expected a JSON array or object of address/quantity pairs.',
		holderListInvalidEntryShape: '{source}: expected {"address","quantity"} or [address, quantity].',
		holderListInvalidLineShape: '{source}: expected "address,quantity".',
		holderListInvalidAddress: '{source}: "{value}" is not a 43-character Arweave address.',
		holderListInvalidQuantityDecimals:
			'{source}: quantity must be a positive token amount with no more than {denomination} decimal places. Use a JSON string for fractional quantities.',
		holderListInvalidQuantityWhole:
			'{source}: quantity must be a positive token amount in whole tokens. Use a JSON string for fractional quantities.',
		holderListEntrySource: 'Entry {number}',
		holderListLineSource: 'Line {number}',
	},
});

export type DispatchMessages = (typeof DISPATCH_MESSAGES)['en'];
