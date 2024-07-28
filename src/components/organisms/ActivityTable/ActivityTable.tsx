import React from 'react';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getAssetsByIds, getRegistryProfiles, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { IconButton } from 'components/atoms/IconButton';
import { Select } from 'components/atoms/Select';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { ACTIVITY_SORT_OPTIONS, AO, ASSETS, REFORMATTED_ASSETS, URLS } from 'helpers/config';
import { RegistryProfileType, SelectOptionType } from 'helpers/types';
import { formatAddress, formatCount, formatDate, isFirefox } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { AssetData } from '../AssetData';

import * as S from './styles';
import { IProps } from './types';

// TODO: collection activity

const GROUP_COUNT = 50;

export default function ActivityTable(props: IProps) {
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const scrollRef = React.useRef(null);

	const [activity, setActivity] = React.useState<any | null>(null);
	const [activityResponse, setActivityResponse] = React.useState<any | null>(null);
	const [activityGroups, setActivityGroups] = React.useState<any | null>(null);
	const [activityCursor, setActivityCursor] = React.useState<string>('0');
	const [activityGroup, setActivityGroup] = React.useState<any>(null);
	const [activitySortType, setActivitySortType] = React.useState<SelectOptionType | null>(ACTIVITY_SORT_OPTIONS[0]);

	const [updating, setUpdating] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			try {
				let data: any = {};
				if (props.assetIds) data.AssetIds = props.assetIds;
				if (props.address) data.Address = props.address;

				const response = await readHandler({
					processId: AO.ucm,
					action: 'Get-Activity',
					data: data,
				});

				if (response) setActivityResponse(response);
			} catch (e: any) {
				console.error(e);
			}
		})();
	}, [props.assetIds, props.address, arProvider.profile]);

	React.useEffect(() => {
		if (activityResponse) {
			let updatedActivity = [];
			if (activityResponse.ListedOrders) updatedActivity.push(...mapActivity(activityResponse.ListedOrders, 'Listing'));
			if (activityResponse.ExecutedOrders)
				updatedActivity.push(...mapActivity(activityResponse.ExecutedOrders, 'Sale'));
			setActivity(updatedActivity);
		}
	}, [activityResponse, arProvider.profile]);

	React.useEffect(() => {
		if (activity && activity.length > 0) {
			setActivityCursor('0');
			switch (activitySortType.id) {
				case 'new-to-old':
					activity.sort((a: any, b: any) => b.timestamp - a.timestamp);
					break;
				case 'old-to-new':
					activity.sort((a: any, b: any) => a.timestamp - b.timestamp);
					break;
			}

			let groups = [];
			for (let i = 0, j = 0; i < activity.length; i += GROUP_COUNT, j++) {
				groups[j] = activity.slice(i, i + GROUP_COUNT);
			}

			setActivityGroups(groups);
		}
	}, [activity, activitySortType]);

	React.useEffect(() => {
		(async function () {
			if (activityGroups) {
				if (activityGroups.length > 0) {
					let currentGroup = activityGroups[Number(activityCursor)];
					const associatedAddresses = [];

					if (currentGroup) {
						associatedAddresses.push(...currentGroup.map((order: any) => order.sender));
						associatedAddresses.push(...currentGroup.map((order: any) => order.receiver));

						let associatedProfiles: RegistryProfileType[] | null = null;
						const uniqueAddresses = [...new Set(associatedAddresses.filter((address) => address !== null))];
						try {
							associatedProfiles = await getRegistryProfiles({ profileIds: uniqueAddresses });
						} catch (e: any) {
							console.error(e);
						}

						if (associatedProfiles) {
							currentGroup = currentGroup.map((order: any) => {
								return {
									...order,
									senderProfile: associatedProfiles.find((profile: RegistryProfileType) => profile.id === order.sender),
									receiverProfile: associatedProfiles.find(
										(profile: RegistryProfileType) => profile.id === order.receiver
									),
								};
							});
						}

						if (props.address) {
							const uniqueAssetIds: any[] = [...new Set(currentGroup.map((order: any) => order.dominantToken))];
							try {
								const assets = await getAssetsByIds({
									ids: uniqueAssetIds,
									sortType: 'recently-listed',
								});
								if (assets && assets.length > 0) {
									currentGroup = currentGroup.map((order: any) => {
										return {
											...order,
											asset: assets.find((asset: any) => asset.data.id === order.dominantToken),
										};
									});
								}
							} catch (e: any) {
								console.error(e);
							}
						}

						setActivityGroup(currentGroup);
						setUpdating(false);
					}
				} else {
					setActivityGroup([]);
					setUpdating(false);
				}
			}
		})();
	}, [activityGroups, activityCursor, props.address]);

	const handleActivitySortType = React.useCallback((option: SelectOptionType) => {
		setActivityGroup(null);
		setActivityGroups(null);
		setActivitySortType(option);
	}, []);

	function mapActivity(orders: any, event: 'Listing' | 'Purchase' | 'Sale') {
		let updatedActivity = [];

		if (orders && orders.length > 0) {
			const mappedActivity = orders.map((order: any) => {
				let orderEvent = event;
				if (
					(props.address && order.Receiver === props.address) ||
					(arProvider && arProvider.profile && arProvider.profile.id && arProvider.profile.id === order.Receiver)
				) {
					orderEvent = 'Purchase';
				}
				return {
					orderId: order.OrderId,
					dominantToken: order.DominantToken,
					swapToken: order.SwapToken,
					price: order.Price.toString(),
					quantity: order.Quantity.toString(),
					sender: order.Sender || null,
					receiver: order.Receiver || null,
					timestamp: order.Timestamp,
					event: orderEvent,
				};
			});

			updatedActivity = mappedActivity;
		}

		return updatedActivity;
	}

	function getDenominatedTokenValue(amount: number, assetId?: string) {
		if (props.asset && props.asset.state && props.asset.state.denomination && props.asset.state.denomination > 1) {
			const denomination = props.asset.state.denomination;
			return `${formatCount((amount / Math.pow(10, denomination)).toString())}`;
		} else if (assetId && REFORMATTED_ASSETS[assetId] && REFORMATTED_ASSETS[assetId].denomination) {
			const denomination = REFORMATTED_ASSETS[assetId].denomination;
			return `${formatCount((amount / Math.pow(10, denomination)).toString())}`;
		} else return formatCount(amount.toString());
	}

	const getPaginationAction = (callback: () => void) => {
		setUpdating(true);
		setActivityGroup(null);
		callback();
	};

	const previousAction = React.useMemo(() => {
		return activityGroups && Number(activityCursor) > 0
			? () => getPaginationAction(() => setActivityCursor((Number(activityCursor) - 1).toString()))
			: null;
	}, [activityGroups, activityCursor]);

	const nextAction = React.useMemo(() => {
		return activityGroups && Number(activityCursor) < Object.keys(activityGroups).length - 1
			? () => getPaginationAction(() => setActivityCursor((Number(activityCursor) + 1).toString()))
			: null;
	}, [activityGroups, activityCursor]);

	const handlePaginationAction = (type: 'next' | 'previous') => {
		const action = type === 'next' ? nextAction : previousAction;
		if (action) {
			action();
			setTimeout(() => {
				if (scrollRef.current) {
					const scrollOptions = isFirefox() ? {} : { behavior: 'smooth' };
					scrollRef.current.scrollIntoView(scrollOptions);
				}
			}, 1);
		}
	};

	const getActivity = React.useMemo(() => {
		if (!activityGroup) {
			return (
				<S.LoadingWrapper>
					{Array.from({ length: GROUP_COUNT }, (_, i) => i + 1).map((index) => (
						<S.TableRow key={index} className={'fade-in border-wrapper-alt1'} />
					))}
				</S.LoadingWrapper>
			);
		}

		if (activityGroup.length <= 0) {
			return (
				<S.EmptyWrapper className={'border-wrapper-alt2'}>
					<span>{language.noActivity}</span>
				</S.EmptyWrapper>
			);
		}

		return (
			<S.TableWrapper className={'border-wrapper-primary scroll-wrapper'}>
				<S.TableHeader>
					{props.address && (
						<S.AssetWrapper>
							<p>Asset</p>
						</S.AssetWrapper>
					)}
					<S.EventWrapper>
						<p>Event</p>
					</S.EventWrapper>
					<S.SenderWrapper>
						<p>Seller</p>
					</S.SenderWrapper>
					<S.ReceiverWrapper>
						<p>Buyer</p>
					</S.ReceiverWrapper>
					<S.QuantityWrapper className={'center-value header'}>
						<p className={'header'}>Quantity</p>
					</S.QuantityWrapper>
					<S.PriceWrapper className={'end-value'}>
						<p>Price</p>
					</S.PriceWrapper>
					<S.TableHeaderValue>
						<p>Date</p>
					</S.TableHeaderValue>
				</S.TableHeader>
				<S.TableBody>
					{activityGroup.map((row: any, index: number) => (
						<S.TableRow key={index}>
							{props.address && row.asset && row.asset.data && (
								<S.AssetWrapper>
									<S.AssetDataWrapper>
										<Link to={`${URLS.asset}${row.asset.data.id}`}>
											<AssetData asset={row.asset} />
										</Link>
									</S.AssetDataWrapper>
									<Link to={`${URLS.asset}${row.asset.data.id}`}>
										<p>{row.asset.data.title || formatAddress(row.asset.data.id, false)}</p>
									</Link>
								</S.AssetWrapper>
							)}
							<S.EventWrapper>
								<S.Event type={row.event}>
									<ReactSVG
										src={row.event === 'Listing' ? ASSETS.orders : row.event === 'Sale' ? ASSETS.sell : ASSETS.buy}
									/>
									<p>{row.event}</p>
								</S.Event>
							</S.EventWrapper>
							<S.SenderWrapper>
								{row.senderProfile ? (
									<OwnerLine
										owner={{
											address: row.sender,
											profile: row.senderProfile,
										}}
										callback={null}
									/>
								) : (
									<S.Entity type={'User'}>
										<p>{formatAddress(row.sender, false)}</p>
									</S.Entity>
								)}
							</S.SenderWrapper>
							<S.ReceiverWrapper>
								{row.receiverProfile ? (
									<OwnerLine
										owner={{
											address: row.receiver,
											profile: row.receiverProfile,
										}}
										callback={null}
									/>
								) : (
									<>
										{row.receiver ? (
											<S.Entity type={'User'}>
												<p>{formatAddress(row.receiver, false)}</p>
											</S.Entity>
										) : (
											<S.Entity type={'UCM'}>
												<p>UCM</p>
											</S.Entity>
										)}
									</>
								)}
							</S.ReceiverWrapper>
							<S.QuantityWrapper className={'center-value'}>
								<p>{getDenominatedTokenValue(row.quantity, row.dominantToken)}</p>
							</S.QuantityWrapper>
							<S.PriceWrapper className={'end-value'}>
								<CurrencyLine amount={row.price} currency={row.swapToken} callback={null} />
							</S.PriceWrapper>
							<S.TableRowValue>
								<p>{formatDate(row.timestamp, 'iso')}</p>
							</S.TableRowValue>
						</S.TableRow>
					))}
				</S.TableBody>
			</S.TableWrapper>
		);
	}, [activityGroup, updating]);

	const start = activity ? Number(activityCursor) * GROUP_COUNT + 1 : '';
	const end = activity ? Math.min((Number(activityCursor) + 1) * GROUP_COUNT, activity.length) : '';

	return (
		<S.Wrapper className={'fade-in'} ref={scrollRef}>
			<S.Header>
				<h4>{`${language.interactions}${activity && activity.length ? ` (${activity.length})` : ''}`}</h4>
				<S.HeaderActions>
					<S.SelectWrapper>
						<Select
							label={null}
							activeOption={activitySortType}
							setActiveOption={(option: SelectOptionType) => handleActivitySortType(option)}
							options={ACTIVITY_SORT_OPTIONS.map((option: SelectOptionType) => option)}
							disabled={!activityGroup || updating}
						/>
					</S.SelectWrapper>
					<S.HeaderPaginator>
						<IconButton
							type={'alt1'}
							src={ASSETS.arrow}
							handlePress={() => handlePaginationAction('previous')}
							disabled={!activityGroup || !previousAction || updating}
							dimensions={{
								wrapper: 30,
								icon: 17.5,
							}}
							tooltip={language.previous}
							className={'table-previous'}
						/>
						<IconButton
							type={'alt1'}
							src={ASSETS.arrow}
							handlePress={() => handlePaginationAction('next')}
							disabled={!activityGroup || !nextAction || updating}
							dimensions={{
								wrapper: 30,
								icon: 17.5,
							}}
							tooltip={language.next}
							className={'table-next'}
						/>
					</S.HeaderPaginator>
				</S.HeaderActions>
			</S.Header>
			<S.SubHeader>
				<p>{`Showing: ${start}-${end}`}</p>
				{updating && <p>{`${language.updating}...`}</p>}
			</S.SubHeader>
			{getActivity}
			<S.Footer>
				<Button
					type={'primary'}
					label={language.previous}
					handlePress={() => handlePaginationAction('previous')}
					disabled={!activityGroup || !previousAction || updating}
				/>
				<Button
					type={'primary'}
					label={language.next}
					handlePress={() => handlePaginationAction('next')}
					disabled={!activityGroup || !nextAction || updating}
				/>
			</S.Footer>
		</S.Wrapper>
	);
}
