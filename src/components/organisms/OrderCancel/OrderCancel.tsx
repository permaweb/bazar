import React from 'react';
import { useDispatch } from 'react-redux';

import { readHandler, sendMessage } from 'api';

import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { PROCESSES } from 'helpers/config';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';
import { IProps } from './types';

export default function OrderCancel(props: IProps) {
	const dispatch = useDispatch();
	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [loading, setLoading] = React.useState<boolean>(false);
	const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
	const [cancelProcessed, setCancelProcessed] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<string | null>(null);

	async function handleOrderCancel() {
		if (arProvider.wallet) {
			setLoading(true);
			try {
				const cancelOrderResponse = await sendMessage({
					processId: PROCESSES.ucm,
					action: 'Cancel-Order',
					wallet: arProvider.wallet,
					data: {
						Pair: [props.listing.token, props.listing.currency],
						OrderTxId: props.listing.id,
					},
				});

				if (cancelOrderResponse) {
					setCancelProcessed(true);
					if (cancelOrderResponse['Order-Cancel-Success'])
						setResponse(cancelOrderResponse['Order-Cancel-Success'].message);
					if (cancelOrderResponse['Order-Cancel-Error']) setResponse(cancelOrderResponse['Order-Cancel-Error'].message);

					const ucmState = await readHandler({
						processId: PROCESSES.ucm,
						action: 'Info',
					});

					dispatch(ucmActions.setUCM(ucmState));
					await new Promise((r) => setTimeout(r, 1000));
					setShowConfirmation(false);
					windowUtils.scrollTo(0, 0, 'smooth');
				}
			} catch (e: any) {
				console.error(e);
			}
			setLoading(false);
		}
	}

	return (
		<>
			<S.Action onClick={() => setShowConfirmation(true)}>
				<span>{`(${language.cancel})`}</span>
			</S.Action>
			{showConfirmation && (
				<Modal header={language.confirmOrderCancel} handleClose={() => setShowConfirmation(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>{language.confirmOrderCancelInfo}</p>
						<S.FlexActions>
							<Button
								type={'primary'}
								label={cancelProcessed ? `${language.complete}!` : language.cancelOrder}
								handlePress={cancelProcessed ? () => {} : handleOrderCancel}
								disabled={loading || cancelProcessed}
								loading={loading}
								height={60}
							/>
						</S.FlexActions>
					</S.MWrapper>
				</Modal>
			)}
			{response && <Notification message={response} type={'success'} callback={() => setResponse(null)} />}
		</>
	);
}
