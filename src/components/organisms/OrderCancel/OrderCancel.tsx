import React from 'react';

import { cancelOrder } from '@permaweb/ucm';

import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { AO } from 'helpers/config';
import { NotificationType } from 'helpers/types';
import * as windowUtils from 'helpers/window';
import { useAppProvider } from 'providers/AppProvider';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import * as S from './styles';
import { IProps } from './types';

export default function OrderCancel(props: IProps) {
	const appProvider = useAppProvider();
	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [loading, setLoading] = React.useState<boolean>(false);
	const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
	const [cancelProcessed, setCancelProcessed] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<NotificationType | null>(null);

	async function handleOrderCancel() {
		if (arProvider.wallet && permawebProvider.profile?.id && permawebProvider.deps) {
			setLoading(true);
			try {
				const cancelOrderId = await cancelOrder(
					permawebProvider.deps,
					{
						orderbookId: AO.ucm,
						orderId: props.listing.id,
						profileId: permawebProvider.profile.id,
						dominantToken: props.listing.token,
						swapToken: props.listing.currency,
					},
					(args: { processing: boolean; success: boolean; message: string }) => {
						console.log(args.message);
					}
				);

				console.log(`Order Cancellation ID: ${cancelOrderId}`);

				setResponse({ status: 'success', message: 'Order cancelled' });

				setCancelProcessed(true);
				appProvider.refreshUcm();
				permawebProvider.setToggleTokenBalanceUpdate(!permawebProvider.toggleTokenBalanceUpdate);
				props.toggleUpdate();
				setShowConfirmation(false);
				setCancelProcessed(false);
				windowUtils.scrollTo(0, 0, 'smooth');
			} catch (e: any) {
				setResponse({ status: 'success', message: e.message ?? 'Error cancelling order' });
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
