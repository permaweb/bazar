import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import Arweave from 'arweave';

import { getProfiles, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Loader } from 'components/atoms/Loader';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { Panel } from 'components/molecules/Panel';
import { AO, ASSETS, URLS } from 'helpers/config';
import { StreakType } from 'helpers/types';
import { formatAddress, formatCount, getTotalTokenBalance } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

const GROUP_COUNT = 15;

export default function Streaks(props: IProps) {
	const navigate = useNavigate();

	const streaksReducer = useSelector((state: RootState) => state.streaksReducer);

	const permawebProvider = usePermawebProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const streaksWrapperRef = React.useRef(null);

	const [streakGroups, setStreakGroups] = React.useState<StreakType[][]>([]);
	const [streaks, setStreaks] = React.useState<StreakType[] | null>(null);
	const [streakCursor, setStreakCursor] = React.useState<number>(0);
	const [streakHolderCount, setStreakHolderCount] = React.useState<number | null>(null);
	const [updating, setUpdating] = React.useState<boolean>(false);

	const [count, setCount] = React.useState<number | null>(null);
	const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
	const [showLeaderboard, setShowLeaderboard] = React.useState<boolean>(false);
	const [currentBlockHeight, setCurrentBlockHeight] = React.useState<number | null>(0);

	const [pixlBalance, setPixlBalance] = React.useState<number | null>(null);
	const [dailyRewards, setDailyRewards] = React.useState<number | null>(null);

	React.useEffect(() => {
		(async function () {
			if (streaksReducer) {
				if (props.profile && props.profile.id && streaksReducer[props.profile.id]) {
					setCount(streaksReducer[props.profile.id].days);
				} else setCount(0);

				const sortedStreaks = Object.entries(streaksReducer)
					.sort(([, a], [, b]) => (b as any).days - (a as any).days)
					.filter((a) => (a as any)[1].days > 0)
					.map((a: any) => {
						return {
							address: a[0],
							days: a[1].days,
							lastHeight: a[1].lastHeight,
							profile: null,
						};
					});

				setStreakHolderCount(sortedStreaks.length);

				let groups = [];
				for (let i = 0, j = 0; i < sortedStreaks.length; i += GROUP_COUNT, j++) {
					groups[j] = sortedStreaks.slice(i, i + GROUP_COUNT);
				}

				setStreakGroups(groups);
			}
		})();
	}, [streaksReducer, props.profile]);

	React.useEffect(() => {
		(async function () {
			if (streakGroups && streakGroups.length > 0) {
				setUpdating(true);
				try {
					const addresses = streakGroups[streakCursor].map((streak: any) => streak.address);
					const profiles = await getProfiles(addresses);
					const updatedStreakGroup = streakGroups[streakCursor].map((streak: any) => ({
						...streak,
						profile: profiles ? profiles.find((profile: any) => profile.id === streak.address) : null,
					}));

					setStreaks((prevStreaks) => {
						const seenAddresses = prevStreaks ? new Set(prevStreaks.map((streak) => streak.address)) : new Set();
						const filteredStreakGroup = updatedStreakGroup.filter((streak) =>
							seenAddresses ? !seenAddresses.has(streak.address) : true
						);
						return [...(prevStreaks || []), ...filteredStreakGroup].sort((a, b) => b.days - a.days);
					});
				} catch (e: any) {
					console.error(e);
				}
				setUpdating(false);
			}
		})();
	}, [streakGroups, streakCursor]);

	React.useEffect(() => {
		(async function () {
			if (props.profile && props.profile.id) {
				if (
					permawebProvider.profile &&
					permawebProvider.profile.id &&
					props.profile.id === permawebProvider.profile.id &&
					permawebProvider.tokenBalances &&
					permawebProvider.tokenBalances[AO.pixl]
				) {
					setPixlBalance(getTotalTokenBalance(permawebProvider.tokenBalances[AO.pixl]));
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
			}
		})();
	}, [permawebProvider.profile, permawebProvider.tokenBalances, props.profile]);

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
				{getStreakIcon(count ?? 0)}
				{<span>{count ?? '...'}</span>}
			</>
		);
	}, [count]);

	const header = React.useMemo(() => {
		if (props.profile && count !== null) {
			let title: string = '';
			let endText: string = '';
			if (permawebProvider.profile && permawebProvider.profile.id && permawebProvider.profile.id === props.profile.id) {
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
	}, [count, props.profile, permawebProvider.profile]);

	const streak = React.useMemo(() => {
		return (
			<>
				{getStreakIcon(count ?? 0)}
				<p>{count !== null ? language.dayStreak(count.toString()).toUpperCase() : '...'}</p>
			</>
		);
	}, [count]);

	const message = React.useMemo(() => {
		if (count !== null && currentBlockHeight) {
			if (count > 0) {
				const rewardsInterval = 720;
				const blockTime = 2;

				let lastHeightDiff = 0;
				if (streaksReducer && props.profile && streaksReducer[props.profile.id]) {
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
		if (!streaks) {
			return (
				<S.MLoadingWrapper>
					<Loader sm relative />
				</S.MLoadingWrapper>
			);
		}

		return (
			<S.StreaksPanelWrapper ref={streaksWrapperRef}>
				<S.StreaksPanelHeader>
					<p>{`${streakHolderCount ? formatCount(streakHolderCount.toString()) : '-'} ${language.streakHolders}`}</p>
				</S.StreaksPanelHeader>
				<S.StreaksWrapper>
					{streaks.map((streak: StreakType, index: number) => {
						return (
							<S.StreakLine key={index}>
								<S.StreakIndex>
									<span>{`${index + 1}.`}</span>
								</S.StreakIndex>
								<S.StreakProfile>
									<OwnerLine
										owner={{
											address: streak.address,
											profile: streak.profile || null,
										}}
										callback={() => {
											setShowDropdown(false);
											setShowLeaderboard(false);
										}}
									/>
								</S.StreakProfile>
								<S.StreakCount>
									<span>{`${language.dayCount(streak.days)}`}</span>
									{getStreakIcon(streak.days)}
								</S.StreakCount>
							</S.StreakLine>
						);
					})}
					{updating && (
						<S.MLoadingWrapper>
							<Loader sm relative />
						</S.MLoadingWrapper>
					)}
				</S.StreaksWrapper>
				<S.PanelActionWrapper>
					<Button
						type={'primary'}
						label={language.back}
						handlePress={() => setShowLeaderboard(false)}
						disabled={false}
						height={40}
					/>
					<Button
						type={'alt1'}
						label={language.loadMore}
						handlePress={() => setStreakCursor(streakCursor + 1)}
						disabled={streakCursor >= streakGroups.length - 1}
						height={40}
					/>
				</S.PanelActionWrapper>
			</S.StreaksPanelWrapper>
		);
	}, [streaks, updating]);

	function getAction() {
		return (
			<S.Action onClick={handleShowDropdown} className={'border-wrapper-primary'}>
				{label}
			</S.Action>
		);
	}

	function getDropdown() {
		return showLeaderboard || !permawebProvider.profile ? (
			<>{leaderboard}</>
		) : (
			<>
				<S.SDHeader>{header}</S.SDHeader>
				<S.SDStreak>{streak}</S.SDStreak>
				{permawebProvider.profile &&
					permawebProvider.profile.id &&
					permawebProvider.profile &&
					permawebProvider.profile.id === props.profile.id && <S.SDMessage>{message}</S.SDMessage>}
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

	return getView();
}
