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
	const [hasStamped, setHasStamped] = React.useState<boolean>(true);

	const [updateCount, setUpdateCount] = React.useState<boolean>(false);

	const [disabled, setDisabled] = React.useState<boolean>(true);

	const [stampNotification, setStampNotification] = React.useState<ResponseType | null>(null);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	React.useEffect(() => {
		(async function () {
			if (props.assetId) {
				if (updateCount) {
					await new Promise((resolve) => setTimeout(resolve, 2500));
				}
				const updatedCount = await stamps.count(props.assetId);
				setCount(updatedCount);
			}
		})();
	}, [props.assetId, updateCount]);

	React.useEffect(() => {
		(async function () {
			if (props.assetId) {
				try {
					await new Promise((r) => setTimeout(r, 2500));
					const hasStamped = await stamps.hasStamped(props.assetId);
					setHasStamped(hasStamped);
					if (hasStamped) {
						setDisabled(true);
					}
					setUpdateCount(false);
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.assetId, updateCount, arProvider.walletAddress]);

	React.useEffect(() => {
		(async function () {
			setDisabled(hasStamped ? true : false);
		})();
	}, [hasStamped]);

	const handleStamp = React.useCallback(async () => {
		try {
			if (props.assetId) {
				setDisabled(true);

				let stamp: any = await stamps.stamp(props.assetId);

				let stampSuccess =
					stamp?.Messages?.length > 0 &&
					stamp.Messages[0].Tags.find((t: any) => {
						return t.name === 'Result' && t.value === 'Success';
					});

				if (!stampSuccess) {
					setDisabled(false);
				} else {
					setUpdateCount(true);
				}
			}
		} catch (e: any) {
			setStampNotification({
				status: false,
				message: e.toString(),
			});
		}
	}, [updateCount, props]);

	function getTotalCount() {
		if (count) return count.total.toString();
		else if (props.stamps) return props.stamps.total.toString();
		else return '0';
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
					title={arProvider.walletAddress ? language.stamp : language.connectWalletToStamp}
					sm={props.sm ? props.sm : false}
					className={'border-wrapper-primary'}
				>
					<p>{getTotalCount()}</p>
					<ReactSVG src={ASSETS.stamps} />
				</S.Wrapper>
			)}
			{props.asButton && (
				<button
					onClick={(e: any) => {
						e.preventDefault();
						handleStamp();
					}}
					disabled={disabled}
				>
					<span>{language.stamp}</span>
				</button>
			)}

			{stampNotification && <Notification message={stampNotification.message} type={'warning'} callback={() => {}} />}
		</>
	);
}
