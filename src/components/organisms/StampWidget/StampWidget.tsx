import React from 'react';
import { ReactSVG } from 'react-svg';

import { stamps } from 'api';

import { Notification } from 'components/atoms/Notification';
import { ASSETS } from 'helpers/config';
import { ResponseType } from 'helpers/types';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function StampWidget(props: IProps) {
	const arProvider = useArweaveProvider();

	const [count, setCount] = React.useState<any>(null);
	const [hasStamped, setHasStamped] = React.useState<boolean>(false);
	const [updateCount, setUpdateCount] = React.useState<boolean>(false);
	const [disabled, setDisabled] = React.useState<boolean>(true);
	const [loading, setLoading] = React.useState<boolean>(false);

	const [stampNotification, setStampNotification] = React.useState<ResponseType | null>(null);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	React.useEffect(() => {
		(async function () {
			if (props.assetId) {
				await new Promise((resolve) => setTimeout(resolve, 2500));
				const updatedCount = await stamps.count(props.assetId);
				setCount(updatedCount);
			}
		})();
	}, [props.assetId, updateCount]);

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
					await new Promise((r) => setTimeout(r, 2500));
					const hasStamped = await stamps.hasStamped(props.assetId);
					setHasStamped(hasStamped);
					setDisabled(hasStamped);
					setUpdateCount(false);
				} catch (e: any) {
					console.error(e);
				}
				setLoading(false);
			}
		})();
	}, [props.assetId, updateCount, arProvider.walletAddress]);

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

				if (!stampSuccess) {
					setDisabled(false);
				} else {
					setStampNotification({
						status: true,
						message: `${language.stampSuccess}!`,
					});
					setUpdateCount(true);
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
	}, [updateCount, props]);

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
					callback={() => {
						console.log('Close');
					}}
				/>
			)}
		</>
	);
}
