import React from 'react';

import { createDataItemSigner, dryrun, message, result } from '@permaweb/aoconnect';

import { getTagValue } from 'helpers/utils';

export default function Landing() {
	const UCM_PROCESS = 'RDNSwCBS1TLoj9E9gman_Bhe0UsA5v-A7VmfDoWmZ-A';

	const [state, setState] = React.useState(null);
	const [errorResponse, setErrorResponse] = React.useState(null);
	const [successResponse, setSuccessResponse] = React.useState(null);

	async function updateState() {
		try {
			setState(null);
			const messageResult = await dryrun({
				process: UCM_PROCESS,
				tags: [{ name: 'Action', value: 'Read' }],
			});

			if (messageResult.Messages && messageResult.Messages.length && messageResult.Messages[0].Data) {
				setState(messageResult.Messages[0].Data);
			}
		} catch (e: any) {
			console.error(e);
			setState('None');
		}
	}

	React.useEffect(() => {
		(async function () {
			await updateState();
			try {
				// const messageData = JSON.stringify([
				// 	'fjgMN5h1bybEULC2ho9SzCc_noUUC3ieYztmlfnxWro',
				// 	'KTzTXT_ANmF84fWEKHzWURD1LWd9QaFR9yfYUwH2Lxw',
				// ]);

				// const messageData = 'bad data'

				const messageData = JSON.stringify({
					Pair: ['fjgMN5h1bybEULC2ho9SzCc_noUUC3ieYztmlfnxWro', 'KTzTXT_ANmF84fWEKHzWURD1LWd9QaFR9yfYUwH2Lxw'],
					AllowTxId: 'Test',
					Quantity: 'Test',
					Price: 'Test',
				});

				const messageResult = await message({
					process: UCM_PROCESS,
					tags: [{ name: 'Action', value: 'Create-Order' }],
					signer: createDataItemSigner(globalThis.arweaveWallet),
					data: messageData,
				});

				const { Messages } = await result({
					message: messageResult,
					process: UCM_PROCESS,
				});

				console.log(Messages);

				if (Messages && Messages.length && Messages[0].Tags && Messages[0].Tags.length) {
					const status = getTagValue(Messages[0].Tags, 'Status');
					const message = getTagValue(Messages[0].Tags, 'Message');
					if (message && status) {
						if (status === 'Error') setErrorResponse(message);
						if (status === 'Success') setSuccessResponse(message);
					}
				}
			} catch (e: any) {
				console.error(e);
				setState('None');
			}
			await updateState();
		})();
	}, []);

	return (
		<div>
			<p>{state || 'Loading...'}</p>
			{errorResponse && <span style={{ color: 'red' }}>{errorResponse}</span>}
			{successResponse && <span style={{ color: 'green' }}>{successResponse}</span>}
		</div>
	);
}
