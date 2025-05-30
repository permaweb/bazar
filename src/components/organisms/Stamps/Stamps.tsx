import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ReactSVG } from 'react-svg';

import { stamps } from 'api';

import { Notification } from 'components/atoms/Notification';
import { ASSETS } from 'helpers/config';
import { ResponseType, StampType } from 'helpers/types';
import { checkEqualObjects } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import * as stampsActions from 'store/stamps/actions';

import * as S from './styles';
import { IProps } from './types';

export default function Stamps(props: IProps) {
	const dispatch = useDispatch();

	const stampsReducer = useSelector((state: RootState) => state.stampsReducer);

	const arProvider = useArweaveProvider();

	const [current, setCurrent] = React.useState<StampType | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<ResponseType | null>(null);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	React.useEffect(() => {
		(async function () {
			if ((props.txId && !current) || !checkEqualObjects(current, stampsReducer?.[props.txId])) {
				let currentStamps = stampsReducer?.[props.txId];
				if (currentStamps) {
					setCurrent(currentStamps);
					setLoading(false);
				} else {
					try {
						if (!current && !props.noAutoFetch) {
							setLoading(true);
							const stampsFetch = await stamps.getStamps({ ids: [props.txId] });

							setCurrent(stampsFetch?.[props.txId] ?? null);
							setLoading(false);

							const hasStampedCheck = await stamps.hasStamped(props.txId);

							currentStamps = {
								...(stampsFetch?.[props.txId] ?? null),
								hasStamped: hasStampedCheck?.[props.txId] ?? false,
							};

							setCurrent(currentStamps);

							const updatedStamps = { ...stampsReducer, [props.txId]: currentStamps };
							dispatch(stampsActions.setStamps(updatedStamps));
						}
					} catch (e: any) {
						console.error(e);
					}
					setLoading(false);
				}
			}
		})();
	}, [stampsReducer, props.txId, arProvider.walletAddress, props.noAutoFetch]);

	async function handlePress(e: any) {
		e.preventDefault();
		e.stopPropagation();

		if (!arProvider.walletAddress) {
			arProvider.setWalletModalVisible(true);
			return;
		}

		try {
			if (props.txId) {
				setLoading(true);

				let stamp: any = await stamps.stamp(props.txId);

				let stampSuccess = stamp?.Messages?.length > 0;

				setLoading(false);

				if (stampSuccess) {
					setCurrent((prev: any) => ({ ...prev, total: prev.total + 1, hasStamped: true }));

					const updatedStamps = {};
					if (stampsReducer) {
						for (const tx of Object.keys(stampsReducer)) {
							updatedStamps[tx] = {
								...(stampsReducer?.[tx] ?? {}),
								total: stampsReducer[tx]?.total + 1,
								hasStamped: true,
							};
						}

						dispatch(stampsActions.setStamps(updatedStamps));
					}

					setResponse({
						status: true,
						message: `${language.stampSuccess}!`,
					});
				} else {
					setResponse({
						status: false,
						message: stamp?.Messages?.[0].Data ?? 'Error stamping',
					});
				}
			}
		} catch (e: any) {
			setLoading(false);
			setResponse({
				status: false,
				message: e ? e.toString() : 'Error stamping',
			});
		}
	}

	function getTotalCount() {
		if (!arProvider.wallet || loading) return '';
		if (current) return `(${current.total.toString()})`;
		else return '';
	}

	function getActionLabel() {
		if (!arProvider.wallet) return `${language.connectWallet}`;
		if (loading) return `${language.loading}...`;
		if (current?.hasStamped === undefined) return `${language.gettingStamps}...`;
		if (current?.hasStamped) return `${language.stamped}`;
		return language.stamp;
	}

	const disabled = arProvider.walletAddress ? !stampsReducer || loading || current?.hasStamped !== false : false;

	return (
		<>
			{!props.asButton && (
				<S.Wrapper
					onClick={(e: any) => handlePress(e)}
					disabled={disabled}
					title={getActionLabel()}
					className={'border-wrapper-alt2'}
				>
					<ReactSVG src={ASSETS.stamps} />
					<p>{`${getActionLabel()} ${getTotalCount()}`}</p>
				</S.Wrapper>
			)}
			{props.asButton && (
				<S.Button onClick={(e: any) => handlePress(e)} disabled={disabled}>
					<span>{`${getActionLabel()} ${getTotalCount()}`}</span>
				</S.Button>
			)}
			{response && (
				<Notification
					message={response.message}
					type={response.status ? 'success' : 'warning'}
					callback={() => setResponse(null)}
				/>
			)}
		</>
	);
}
