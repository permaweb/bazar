import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ReactSVG } from 'react-svg';

import { stamps } from 'api';

import { Notification } from 'components/atoms/Notification';
import { ASSETS } from 'helpers/config';
import { ResponseType } from 'helpers/types';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import * as stampsActions from 'store/stamps/actions';

import * as S from './styles';
import { IProps } from './types';

export default function StampWidget(props: IProps) {
	const dispatch = useDispatch();

	const stampsReducer = useSelector((state: RootState) => state.stampsReducer);

	const arProvider = useArweaveProvider();

	const [count, setCount] = React.useState<any>(null);
	const [hasStamped, setHasStamped] = React.useState<boolean>(false);
	const [disabled, setDisabled] = React.useState<boolean>(true);
	const [loading, setLoading] = React.useState<boolean>(false);

	const [stampNotification, setStampNotification] = React.useState<ResponseType | null>(null);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	React.useEffect(() => {
		(async function () {
			if (props.assetId && !count) {
				setCount(stampsReducer?.[props.assetId] ?? 0);
			}
		})();
	}, [props.assetId, stampsReducer]);

	React.useEffect(() => {
		if (!arProvider.walletAddress) {
			setDisabled(true);
		} else {
			setDisabled(disabled);
		}
	}, [arProvider.walletAddress]);

	React.useEffect(() => {
		(async function () {
			if (props.assetId && arProvider.walletAddress) {
				setLoading(true);
				try {
					setHasStamped(stampsReducer?.[props.assetId].hasStamped ?? false);
					setDisabled(stampsReducer?.[props.assetId].hasStamped ?? true);
				} catch (e: any) {
					console.error(e);
				}
				setLoading(false);
			}
		})();
	}, [props.assetId, arProvider.walletAddress, stampsReducer]);

	const handleStamp = React.useCallback(async () => {
		try {
			if (props.assetId) {
				setDisabled(true);
				setLoading(true);

				let stamp: any = await stamps.stamp(props.assetId);

				let stampSuccess =
					stamp?.Messages?.length > 0 &&
					stamp.Messages[0].Tags.find((t: any) => {
						return t.name === 'Result' && t.value === 'Success';
					});

				setLoading(false);

				if (stampSuccess) {
					setCount((prev: any) => ({ ...prev, total: prev.total + 1 }));
					setHasStamped(true);

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

					setStampNotification({
						status: true,
						message: `${language.stampSuccess}!`,
					});
				} else {
					setDisabled(false);
				}
			}
		} catch (e: any) {
			setLoading(false);
			setDisabled(false);
			setStampNotification({
				status: false,
				message: e.toString(),
			});
		}
	}, [props, stampsReducer]);

	function getTotalCount() {
		if (!arProvider.wallet || loading) return '';
		if (count) return `(${count.total.toString()})`;
		else if (props.stamps) return `(${props.stamps.total.toString()})`;
		else return '';
	}

	function getActionLabel() {
		if (loading) return `${language.loading}...`;
		if (!arProvider.wallet) return `${language.connectWallet}`;
		if (hasStamped) return `${language.stamped}`;
		return language.stamp;
	}

	return (
		<>
			{!props.asButton && (
				<S.Wrapper
					onClick={(e: any) => {
						e.preventDefault();
						handleStamp();
					}}
					disabled={disabled}
					title={getActionLabel()}
					className={'border-wrapper-alt2'}
				>
					<ReactSVG src={ASSETS.stamps} />
					<p>{`${getActionLabel()} ${getTotalCount()}`}</p>
				</S.Wrapper>
			)}
			{props.asButton && (
				<S.Button
					onClick={(e: any) => {
						e.preventDefault();
						handleStamp();
					}}
					disabled={disabled}
				>
					<span>{`${getActionLabel()} ${getTotalCount()}`}</span>
				</S.Button>
			)}

			{stampNotification && (
				<Notification
					message={stampNotification.message}
					type={stampNotification.status ? 'success' : 'warning'}
					callback={() => setStampNotification(null)}
				/>
			)}
		</>
	);
}
