import React from 'react';
import { useSelector } from 'react-redux';
import { ReactSVG } from 'react-svg';

import Arweave from 'arweave';

import { getRegistryProfiles } from 'api';

import { Button } from 'components/atoms/Button';
import { Modal } from 'components/molecules/Modal';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { Panel } from 'components/molecules/Panel';
import { ASSETS } from 'helpers/config';
import { RegistryProfileType } from 'helpers/types';
import { formatAddress, formatCount } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

export default function Streaks(props: IProps) {
	const streaksReducer = useSelector((state: RootState) => state.streaksReducer);

	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [count, setCount] = React.useState<number>(0);
	const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
	const [showLeaderboard, setShowLeaderboard] = React.useState<boolean>(false);
	const [profiles, setProfiles] = React.useState<RegistryProfileType[] | null>(null);
	const [currentBlockHeight, setCurrentBlockHeight] = React.useState<number | null>(0);

	React.useEffect(() => {
		(async function () {
			if (props.profile && props.profile.id) {
				if (streaksReducer) {
					if (streaksReducer[props.profile.id]) {
						setCount(streaksReducer[props.profile.id].days);
					}

					try {
						const addresses = Object.keys(streaksReducer).map((address: string) => address);
						const profiles = await getRegistryProfiles({ profileIds: addresses });
						setProfiles(profiles);
					} catch (e: any) {
						console.error(e);
					}
				}
			}
		})();
	}, [streaksReducer, props.profile.id]);

	React.useEffect(() => {
		(async function () {
			if (showDropdown) {
				const info = await Arweave.init({}).network.getInfo();
				setCurrentBlockHeight(info.height);
			}
		})();
	}, [showDropdown]);

	function getRangeLabel(number: number) {
		if (number >= 0 && number <= 7) return '0-7';
		if (number >= 8 && number <= 14) return '8-14';
		if (number >= 15 && number <= 29) return '15-29';
		if (number >= 30) return '30+';
		return 'out-of-range';
	}

	function getStreakIcon(count: number) {
		if (count !== null) {
			let icon: string;
			switch (getRangeLabel(count)) {
				case '0-7':
					icon = ASSETS.streak1;
					break;
				case '8-14':
					icon = ASSETS.streak2;
					break;
				case '15-29':
					icon = ASSETS.streak3;
					break;
				case '30+':
					icon = ASSETS.streak4;
					break;
				default:
					break;
			}
			return <img src={icon} />;
		} else return null;
	}

	const handleShowDropdown = React.useCallback(() => {
		setShowDropdown((prev) => !prev);
	}, []);

	const label = React.useMemo(() => {
		return (
			<>
				{getStreakIcon(count)}
				<span>{count}</span>
			</>
		);
	}, [count]);

	const header = React.useMemo(() => {
		if (props.profile && count !== null) {
			let title: string = '';
			let endText: string = '';
			if (arProvider.profile && arProvider.profile.id && arProvider.profile.id === props.profile.id) {
				endText = '!';
				switch (getRangeLabel(count)) {
					case '0-7':
						title = `${count <= 0 ? language.streakTitle1 : language.streakTitle2}, `;
						break;
					case '8-14':
						title = `${language.streakTitle3}, `;
						break;
					case '15-29':
						title = `${language.streakTitle4}, `;
						break;
					case '30+':
						title = `${language.streakTitle5}, `;
						break;
					default:
						break;
				}
			} else {
				endText = `'s ${language.streak}`;
			}
			return (
				<p>{`${title}${
					props.profile.username ? props.profile.username : formatAddress(props.profile.id, false)
				}${endText}`}</p>
			);
		} else return null;
	}, [count, props.profile, arProvider.profile]);

	const streak = React.useMemo(() => {
		return (
			<>
				{getStreakIcon(count)}
				<p>{language.dayStreak(count.toString()).toUpperCase()}</p>
			</>
		);
	}, [count]);

	const message = React.useMemo(() => {
		if (count !== null && currentBlockHeight) {
			if (count > 0) {
				const rewardsInterval = 720;
				const blockTime = 2;

				const lastHeightDiff = currentBlockHeight - streaksReducer[props.profile.id].lastHeight;
				const remainingBlocks = rewardsInterval - lastHeightDiff;

				const remainingBlockMinutes = Math.abs(remainingBlocks) * blockTime;

				const hours = Math.floor(remainingBlockMinutes / 60);
				const minutes = remainingBlockMinutes % 60;

				return lastHeightDiff <= 1440 ? (
					<>
						<S.SDMessageInfo>
							<span>{language.streakCountdown1}</span>
						</S.SDMessageInfo>
						<S.SDMessageCount className={'border-wrapper-alt1'}>
							<S.SDMessageCountUnit>
								<p>{hours}</p>
								<span>{hours === 1 ? 'hour' : 'hours'}</span>
							</S.SDMessageCountUnit>
							<S.SDMessageCountDivider>
								<span>:</span>
							</S.SDMessageCountDivider>
							<S.SDMessageCountUnit>
								<p>{minutes}</p>
								<span>{minutes === 1 ? 'minute' : 'minutes'}</span>
							</S.SDMessageCountUnit>
						</S.SDMessageCount>
						<S.SDMessageInfo>
							<span>{`${hours <= 0 && minutes <= 0 ? language.streakCountdown3 : language.streakCountdown2}!`}</span>
						</S.SDMessageInfo>
					</>
				) : (
					<S.SDMessageInfo>
						<span>{`${language.streakStart}!`}</span>
					</S.SDMessageInfo>
				);
			} else {
				return (
					<S.SDMessageInfo>
						<span>{`${language.streakStart}!`}</span>
					</S.SDMessageInfo>
				);
			}
		} else {
			return (
				<S.SDMessageInfo>
					<span>{`${language.loading}...`}</span>
				</S.SDMessageInfo>
			);
		}
	}, [count, currentBlockHeight, props.profile, streaksReducer]);

	// TODO: get amounts
	const amounts = React.useMemo(() => {
		return (
			<>
				<S.SDAmount>
					<p>
						{`+${formatCount('500')}`}
						<ReactSVG src={ASSETS.pixl} />
					</p>
					<span>{language.dailyRewards}</span>
				</S.SDAmount>
				<S.SDAmount>
					<p>
						{`${formatCount('12387')}`}
						<ReactSVG src={ASSETS.pixl} />
					</p>
					<span>{language.pixlHoldings}</span>
				</S.SDAmount>
			</>
		);
	}, []);

	const leaderboard = React.useMemo(() => {
		return streaksReducer && profiles ? (
			<S.StreaksWrapper>
				{Object.keys(streaksReducer).map((address: string, index: number) => {
					const addressCount = streaksReducer[address].days;
					const profile = profiles.find((profile: RegistryProfileType) => profile.id === address);
					return (
						<S.StreakLine key={index}>
							<S.StreakIndex>
								<span>{`${index + 1}.`}</span>
							</S.StreakIndex>
							<S.StreakProfile>
								<OwnerLine
									owner={{
										address: address,
										profile: profile || null,
									}}
									callback={() => {
										setShowDropdown(false);
										setShowLeaderboard(false);
									}}
								/>
							</S.StreakProfile>
							<S.StreakCount>
								<span>{`${language.dayCount(addressCount)}`}</span>
								{getStreakIcon(addressCount)}
							</S.StreakCount>
						</S.StreakLine>
					);
				})}
			</S.StreaksWrapper>
		) : (
			<S.MLoadingWrapper>
				<span>{`${language.loading}...`}</span>
			</S.MLoadingWrapper>
		);
	}, [streaksReducer, profiles]);

	function getAction() {
		return (
			<S.Action onClick={handleShowDropdown} className={'border-wrapper-primary'}>
				{label}
			</S.Action>
		);
	}

	function getDropdown() {
		return (
			<>
				<S.SDHeader>{header}</S.SDHeader>
				<S.SDStreak>{streak}</S.SDStreak>
				{arProvider.profile && arProvider.profile.id && arProvider.profile.id === props.profile.id && (
					<S.SDMessage>{message}</S.SDMessage>
				)}
				<S.SDAmounts>{amounts}</S.SDAmounts>
				<S.SDLAction>
					<Button
						type={'alt1'}
						label={language.streakLeaderboard}
						handlePress={() => setShowLeaderboard(true)}
						icon={ASSETS.leaderboard}
						iconLeftAlign
						height={45}
						fullWidth
					/>
				</S.SDLAction>
			</>
		);
	}

	function getView() {
		return (
			<S.Wrapper>
				{getAction()}
				{showDropdown && (
					<Panel open={showDropdown} header={language.streaks} handleClose={handleShowDropdown}>
						{getDropdown()}
					</Panel>
				)}
			</S.Wrapper>
		);
	}

	return props.profile && props.profile.id ? (
		<>
			{getView()}
			{showLeaderboard && (
				<Modal header={language.streakLeaderboard} handleClose={() => setShowLeaderboard(false)}>
					<S.MWrapper className={'modal-wrapper'}>{leaderboard}</S.MWrapper>
				</Modal>
			)}
		</>
	) : null;
}
