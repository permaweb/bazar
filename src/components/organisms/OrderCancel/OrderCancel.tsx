import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { messageResults, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { AOS } from 'helpers/config';
import { NotificationType } from 'helpers/types';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';
import { IProps } from './types';

export default function OrderCancel(props: IProps) {
	const dispatch = useDispatch();

	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
	const [cancelProcessed, setCancelProcessed] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<NotificationType | null>(null);

	async function handleOrderCancel() {
		if (arProvider.wallet && arProvider.profile && arProvider.profile.id) {
			setLoading(true);
			try {
				const response = await messageResults({
					processId: arProvider.profile.id,
					action: 'Run-Action',
					wallet: arProvider.wallet,
					tags: null,
					data: {
						Target: AOS.ucm,
						Action: 'Cancel-Order',
						Input: JSON.stringify({
							Pair: [props.listing.token, props.listing.currency],
							OrderTxId: props.listing.id,
						}),
					},
					handler: 'Cancel-Order',
				});

				if (response) {
					if (response['Action-Response']) {
						setResponse({
							message: response['Action-Response'].message,
							status: response['Action-Response'].status === 'Success' ? 'success' : 'warning',
						});
					} else {
						setResponse({
							message: 'Order cancelled',
							status: 'success',
						});
					}

					setCancelProcessed(true);

					arProvider.setToggleTokenBalanceUpdate(!arProvider.toggleTokenBalanceUpdate);
					props.toggleUpdate();

					const existingUCM = { ...ucmReducer };
					const maxTries = 10;
					let tries = 0;
					let changeDetected = false;

					const fetchUntilChange = async () => {
						while (!changeDetected && tries < maxTries) {
							const ucmState = await readHandler({
								processId: AOS.ucm,
								action: 'Info',
							});

							dispatch(ucmActions.setUCM(ucmState));

							if (JSON.stringify(existingUCM) !== JSON.stringify(ucmState)) {
								changeDetected = true;
							} else {
								await new Promise((resolve) => setTimeout(resolve, 1000));
								tries++;
							}
						}

						if (!changeDetected) {
							console.warn(`No changes detected after ${maxTries} attempts`);
						}
					};

					await fetchUntilChange();
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
			{response && (
				<Notification message={response.message} type={response.status} callback={() => setResponse(null)} />
			)}
		</>
	);
}
