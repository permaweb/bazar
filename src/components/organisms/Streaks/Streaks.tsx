import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import Arweave from 'arweave';

import { getRegistryProfiles, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { Panel } from 'components/molecules/Panel';
import { AO, ASSETS, URLS } from 'helpers/config';
import { RegistryProfileType } from 'helpers/types';
import { formatAddress, getTotalTokenBalance } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

export default function Streaks(props: IProps) {
	const navigate = useNavigate();

	const streaksReducer = useSelector((state: RootState) => state.streaksReducer);

	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [count, setCount] = React.useState<number>(0);
	const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
	const [showLeaderboard, setShowLeaderboard] = React.useState<boolean>(false);
	const [profiles, setProfiles] = React.useState<RegistryProfileType[] | null>(null);
	const [currentBlockHeight, setCurrentBlockHeight] = React.useState<number | null>(0);

	const [pixlBalance, setPixlBalance] = React.useState<number | null>(null);
	const [dailyRewards, setDailyRewards] = React.useState<number | null>(null);

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
			if (
				props.profile &&
				arProvider.profile &&
				arProvider.profile.id &&
				props.profile.id === arProvider.profile.id &&
				arProvider.tokenBalances &&
				arProvider.tokenBalances[AO.pixl]
			) {
				setPixlBalance(getTotalTokenBalance(arProvider.tokenBalances[AO.pixl]));
			} else {
				try {
					const pixlTokenBalance = await readHandler({
						processId: AO.pixl,
						action: 'Balance',
						tags: [{ name: 'Recipient', value: props.profile.id }],
					});

					if (pixlTokenBalance) setPixlBalance(pixlTokenBalance);
				} catch (e: any) {
					console.error(e);
				}
			}

			try {
				const currentRewards = await readHandler({
					processId: AO.pixl,
					action: 'Read-Current-Rewards',
					tags: [{ name: 'Recipient', value: props.profile.id }],
				});

				if (currentRewards) setDailyRewards(currentRewards);
			} catch (e: any) {
				console.error(e);
			}
		})();
	}, [arProvider.profile, arProvider.tokenBalances, props.profile]);

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

				let lastHeightDiff = 0;
				if (streaksReducer && streaksReducer[props.profile.id]) {
					lastHeightDiff = currentBlockHeight - streaksReducer[props.profile.id].lastHeight;
				}

				const remainingBlocks = rewardsInterval - lastHeightDiff;

				const windowActive = lastHeightDiff > rewardsInterval && lastHeightDiff <= rewardsInterval * 2;
				let remainingBlockMinutes: number;
				if (windowActive) {
					remainingBlockMinutes = (rewardsInterval * 2 - lastHeightDiff) * blockTime;
				} else {
					remainingBlockMinutes = Math.abs(remainingBlocks) * blockTime;
				}

				const hours = Math.floor(remainingBlockMinutes / 60);
				const minutes = remainingBlockMinutes % 60;

				return lastHeightDiff <= rewardsInterval * 2 ? (
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
							<span>{`${windowActive ? language.streakCountdown3 : language.streakCountdown2}!`}</span>
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

	const amounts = React.useMemo(() => {
		return pixlBalance | dailyRewards ? (
			<>
				{pixlBalance !== null && (
					<S.SDAmount>
						<div>
							<CurrencyLine amount={pixlBalance} currency={AO.pixl} callback={() => setShowDropdown(false)} />
						</div>
						<p>{language.pixlHoldings}</p>
					</S.SDAmount>
				)}
				{dailyRewards !== null && (
					<S.SDAmount>
						<div>
							<CurrencyLine amount={dailyRewards} currency={AO.pixl} callback={() => setShowDropdown(false)} />
						</div>
						<p>{language.dailyRewards}</p>
					</S.SDAmount>
				)}
			</>
		) : (
			<S.SDAmount>
				<S.SDPIXLMessage>
					<p>{language.pixlBalanceInfo}</p>
				</S.SDPIXLMessage>
			</S.SDAmount>
		);
	}, [dailyRewards, pixlBalance]);

	const leaderboard = React.useMemo(() => {
		if (!streaksReducer || !profiles) {
			return (
				<S.MLoadingWrapper>
					<span>{`${language.loading}...`}</span>
				</S.MLoadingWrapper>
			);
		}

		const sortedStreaks = Object.entries(streaksReducer)
			.sort(([, a], [, b]) => (b as any).days - (a as any).days)
			.filter((a) => (a as any)[1].days > 0);

		return (
			<S.StreaksPanelWrapper>
				<S.StreaksWrapper>
					{(sortedStreaks as any).map(([address, { days }], index: number) => {
						const profile = profiles.find((profile) => profile.id === address);
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
									<span>{`${language.dayCount(days)}`}</span>
									{getStreakIcon(days)}
								</S.StreakCount>
							</S.StreakLine>
						);
					})}
				</S.StreaksWrapper>
				<S.ReturnWrapper>
					<Button
						type={'primary'}
						label={'Go back'}
						handlePress={() => setShowLeaderboard(false)}
						height={50}
						fullWidth
					/>
				</S.ReturnWrapper>
			</S.StreaksPanelWrapper>
		);
	}, [streaksReducer, profiles]);

	function getAction() {
		return (
			<S.Action onClick={handleShowDropdown} className={'border-wrapper-alt2'}>
				{label}
			</S.Action>
		);
	}

	function getDropdown() {
		return showLeaderboard ? (
			<>{leaderboard}</>
		) : (
			<>
				<S.SDHeader>{header}</S.SDHeader>
				<S.SDStreak>{streak}</S.SDStreak>
				{arProvider.profile && arProvider.profile.id && arProvider.profile.id === props.profile.id && (
					<S.SDMessage>{message}</S.SDMessage>
				)}
				<S.SDAmounts>
					{amounts}
					<S.SDLAction>
						<Button
							type={'primary'}
							label={language.tradePixl}
							handlePress={() => {
								navigate(`${URLS.asset}${AO.pixl}`);
								setShowDropdown(false);
								setShowLeaderboard(false);
							}}
							height={45}
							fullWidth
						/>
					</S.SDLAction>
				</S.SDAmounts>
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
					<Panel
						open={showDropdown || showLeaderboard}
						header={showLeaderboard ? language.leaderboard : language.streaks}
						handleClose={showLeaderboard ? () => setShowLeaderboard(false) : handleShowDropdown}
					>
						{getDropdown()}
					</Panel>
				)}
			</S.Wrapper>
		);
	}

	return props.profile && props.profile.id ? <>{getView()}</> : null;
}
