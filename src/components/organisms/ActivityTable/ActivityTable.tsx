import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getAndUpdateRegistryProfiles, getAssetsByIds, readHandler } from 'api';
import { getUserActivity } from 'api/activity';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { IconButton } from 'components/atoms/IconButton';
import { Select } from 'components/atoms/Select';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { ACTIVITY_SORT_OPTIONS, AO, ASSETS, REDIRECTS, REFORMATTED_ASSETS, URLS } from 'helpers/config';
import { SelectOptionType } from 'helpers/types';
import { formatAddress, formatCount, formatDate, getRelativeDate, isFirefox } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import { AssetData } from '../AssetData';

import * as S from './styles';
import { IProps } from './types';

const GROUP_COUNT = 50;

// Define RegistryProfileType locally since it's not exported from helpers/types
interface RegistryProfileType {
	id: string;
	name?: string;
	handle?: string;
	avatar?: string;
	[key: string]: any;
}

// Define common order type
interface OrderType {
	OrderId: string;
	DominantToken: string;
	SwapToken: string;
	Sender: string;
	Receiver: string | null;
	Quantity: string;
	Price: string;
	Timestamp: string;
}

export default function ActivityTable(props: IProps) {
	const profilesReducer = useSelector((state: RootState) => state.profilesReducer);

	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const scrollRef = React.useRef(null);

	const groupCount = props.groupCount || GROUP_COUNT;

	const [activity, setActivity] = React.useState<any | null>(null);
	const [activityResponse, setActivityResponse] = React.useState<any | null>(null);
	const [activityGroups, setActivityGroups] = React.useState<any | null>(null);
	const [activityGroup, setActivityGroup] = React.useState<any>(null);
	const [activityCursor, setActivityCursor] = React.useState<string>('0');
	const [activitySortType, setActivitySortType] = React.useState<SelectOptionType | null>(ACTIVITY_SORT_OPTIONS[0]);

	const [updating, setUpdating] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			try {
				setUpdating(true);

				const getAssetActivityByAssetId = async ({
					assetId,
					processId = AO.ucmActivity,
				}: {
					assetId: string;
					processId?: string;
				}) => {
					const response = await readHandler<{
						ListedOrders: Array<OrderType>;
						ExecutedOrders: Array<OrderType>;
						CancelledOrders: Array<OrderType>;
					}>({
						processId,
						action: 'Get-Activity',
						data: { AssetIds: [assetId] },
					});

					return response;
				};

				if (props.asset && props.asset.data) {
					// If we have a specific asset, use the UCM process
					const response = await readHandler<{ [key: string]: number }>({
						processId: AO.ucmActivity,
						action: 'Get-Activity',
						data: { AssetIds: [props.asset.data.id] },
					});

					if (response) setActivityResponse(response);
					else {
						setActivity([]);
						setActivityGroup([]);
						setActivityGroups([]);
					}
				} else if (props.address) {
					// If we have an address, use the new gateway-based activity fetching
					const userActivity = await getUserActivity(
						props.address,
						props.startDate ? new Date(props.startDate) : undefined,
						props.endDate ? new Date(props.endDate) : undefined
					);

					// Format the response to match what the component expects
					const formattedResponse = {
						ListedOrders: userActivity.listedOrders.map((order) => ({
							OrderId: order.orderId,
							DominantToken: order.dominantToken,
							SwapToken: order.swapToken,
							Price: order.price,
							Quantity: order.quantity,
							Sender: order.sender,
							Receiver: order.receiver,
							Timestamp: order.timestamp,
						})),
						ExecutedOrders: userActivity.executedOrders.map((order) => ({
							OrderId: order.orderId,
							DominantToken: order.dominantToken,
							SwapToken: order.swapToken,
							Price: order.price,
							Quantity: order.quantity,
							Sender: order.sender,
							Receiver: order.receiver,
							Timestamp: order.timestamp,
						})),
						CancelledOrders: userActivity.cancelledOrders.map((order) => ({
							OrderId: order.orderId,
							DominantToken: order.dominantToken,
							SwapToken: order.swapToken,
							Price: order.price,
							Quantity: order.quantity,
							Sender: order.sender,
							Receiver: order.receiver,
							Timestamp: order.timestamp,
						})),
						DirectTransfers: userActivity.directTransfers
							? userActivity.directTransfers.map((order) => ({
									OrderId: order.orderId,
									DominantToken: order.dominantToken,
									SwapToken: order.swapToken,
									Price: order.price,
									Quantity: order.quantity,
									Sender: order.sender,
									Receiver: order.receiver,
									Timestamp: order.timestamp,
									IsDirectTransfer: true,
							  }))
							: [],
					};

					setActivityResponse(formattedResponse);
				} else if (props.assetIds) {
					// If we have asset IDs, use the UCM process
					const response = await readHandler({
						processId: AO.ucmActivity,
						action: 'Get-Activity',
						data: { AssetIds: props.assetIds },
					});

					if (response) setActivityResponse(response);
					else {
						setActivity([]);
						setActivityGroup([]);
						setActivityGroups([]);
					}
				} else {
					setActivity([]);
					setActivityGroup([]);
					setActivityGroups([]);
				}

				setUpdating(false);
			} catch (e: any) {
				console.error(e);
				setUpdating(false);
			}
		})();
	}, [props.asset, props.assetIds, props.address, props.startDate, props.endDate, arProvider.profile]);

	React.useEffect(() => {
		if (activityResponse) {
			let updatedActivity = [];
			if (activityResponse.ListedOrders) updatedActivity.push(...mapActivity(activityResponse.ListedOrders, 'Listing'));
			if (activityResponse.ExecutedOrders)
				updatedActivity.push(...mapActivity(activityResponse.ExecutedOrders, 'Sale'));
			if (activityResponse.CancelledOrders)
				updatedActivity.push(...mapActivity(activityResponse.CancelledOrders, 'Unlisted'));
			if (activityResponse.DirectTransfers)
				updatedActivity.push(...mapActivity(activityResponse.DirectTransfers, 'Transfer'));

			setActivity(updatedActivity);
			if (updatedActivity.length <= 0) {
				setActivityGroup([]);
				setActivityGroups([]);
			}
		}
	}, [activityResponse, arProvider.profile]);

	React.useEffect(() => {
		if (activity && activity.length > 0) {
			setActivityCursor('0');
			switch (activitySortType.id) {
				case 'new-to-old':
					activity.sort((a: any, b: any) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
					break;
				case 'old-to-new':
					activity.sort((a: any, b: any) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
					break;
			}

			let groups = [];
			for (let i = 0, j = 0; i < activity.length; i += groupCount, j++) {
				groups[j] = activity.slice(i, i + groupCount);
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
						// Get all unique addresses for profiles
						associatedAddresses.push(...currentGroup.map((order: any) => order.sender));
						associatedAddresses.push(...currentGroup.map((order: any) => order.receiver));
						const uniqueAddresses = [...new Set(associatedAddresses.filter((address) => address !== null))];

						// Get all unique asset IDs
						const uniqueAssetIds = [...new Set(currentGroup.map((order: any) => order.dominantToken))] as string[];

						// Fetch profiles and assets in parallel
						const [associatedProfiles, assets] = await Promise.all([
							getAndUpdateRegistryProfiles(uniqueAddresses),
							!props.asset
								? getAssetsByIds({
										ids: uniqueAssetIds,
										sortType: 'recently-listed',
								  })
								: null,
						]);

						// Update the current group with profiles and assets
						currentGroup = currentGroup.map((order: any) => {
							const updatedOrder = {
								...order,
								senderProfile: associatedProfiles?.find((profile: RegistryProfileType) => profile.id === order.sender),
								receiverProfile: associatedProfiles?.find(
									(profile: RegistryProfileType) => profile.id === order.receiver
								),
							};

							if (assets && assets.length > 0) {
								const matchedAsset = assets.find((asset: any) => asset.data.id === order.dominantToken);
								if (matchedAsset) {
									// Keep the original asset data structure
									updatedOrder.asset = matchedAsset;
								}
							}

							return updatedOrder;
						});

						setActivityGroup(currentGroup);
						setUpdating(false);
					}
				} else {
					setActivityGroup([]);
					setUpdating(false);
				}
			}
		})();
	}, [activityGroups, activityCursor, props.address, props.asset, profilesReducer?.registryProfiles]);

	const handleActivitySortType = React.useCallback((option: SelectOptionType) => {
		setActivityGroup(null);
		setActivityGroups(null);
		setActivitySortType(option);
	}, []);

	function mapActivity(orders: any, event: 'Listing' | 'Purchase' | 'Sale' | 'Unlisted' | 'Transfer') {
		let updatedActivity = [];

		if (orders && orders.length > 0) {
			const mappedActivity = orders.map((order: any) => {
				let orderEvent = event;
				if (event === 'Sale') {
					if (
						(props.address && order.Receiver === props.address) ||
						(arProvider && arProvider.profile && arProvider.profile.id && arProvider.profile.id === order.Receiver)
					) {
						orderEvent = 'Purchase';
					}
				}

				const price = parseInt(order.Price || '0', 10);
				const quantity = parseInt(order.Quantity || '0', 10);
				const timestamp = parseInt(order.Timestamp || '0', 10);

				return {
					orderId: order.OrderId,
					dominantToken: order.DominantToken,
					swapToken: order.SwapToken,
					price: price,
					quantity: quantity,
					sender: order.Sender || null,
					receiver: order.Receiver || null,
					timestamp: timestamp,
					event: orderEvent,
					asset: null, // Will be populated later with asset data
				};
			});

			updatedActivity = mappedActivity;
		}

		return updatedActivity;
	}

	function getDenominatedTokenValue(amount: number, assetId?: string) {
		// Handle extremely large numbers
		if (amount > 1e12) {
			return formatCount((amount / 1e12).toString()) + 'T';
		} else if (amount > 1e9) {
			return formatCount((amount / 1e9).toString()) + 'B';
		} else if (amount > 1e6) {
			return formatCount((amount / 1e6).toString()) + 'M';
		} else if (amount > 1e3) {
			return formatCount((amount / 1e3).toString()) + 'K';
		}

		// Handle normal numbers with denomination
		if (props.asset && props.asset.state && props.asset.state.denomination && props.asset.state.denomination > 1) {
			const denomination = props.asset.state.denomination;
			return formatCount((amount / Math.pow(10, denomination)).toString());
		} else if (assetId && REFORMATTED_ASSETS[assetId] && REFORMATTED_ASSETS[assetId].denomination) {
			const denomination = REFORMATTED_ASSETS[assetId].denomination;
			return formatCount((amount / Math.pow(10, denomination)).toString());
		}

		return formatCount(amount.toString());
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

	const start = activity && activity.length ? Number(activityCursor) * groupCount + 1 : '';
	const end = activity && activity.length ? Math.min((Number(activityCursor) + 1) * groupCount, activity.length) : '';

	const getReceiverContent = React.useMemo(
		() => (row: any) => {
			if (row.receiverProfile) {
				if (row.receiverProfile.id === AO.ucm) {
					return (
						<S.Entity type={'UCM'}>
							<p>UCM</p>
						</S.Entity>
					);
				}
				return (
					<OwnerLine
						owner={{
							address: row.receiver,
							profile: row.receiverProfile,
						}}
						callback={null}
					/>
				);
			} else if (row.receiver) {
				return (
					<S.Entity type={'User'}>
						<p>{formatAddress(row.receiver, false)}</p>
					</S.Entity>
				);
			}
			return <p>-</p>;
		},
		[]
	);

	const getActivity = React.useMemo(() => {
		if (!activityGroup) {
			return (
				<S.LoadingWrapper>
					{Array.from({ length: groupCount }, (_, i) => i + 1).map((index) => (
						<S.TableRowLoader key={index} className={'fade-in border-wrapper-alt1'} />
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

		function getEventIcon(event: string) {
			switch (event) {
				case 'Listing':
					return ASSETS.orders;
				case 'Sale':
					return ASSETS.sell;
				case 'Unlisted':
					return ASSETS.close;
				default:
					return ASSETS.buy;
			}
		}

		return (
			<S.TableWrapper className={'scroll-wrapper'}>
				<S.TableHeader>
					<S.AssetWrapper>
						<p>{language.asset}</p>
					</S.AssetWrapper>
					<S.EventWrapper>
						<p>{language.event}</p>
					</S.EventWrapper>
					<S.SenderWrapper>
						<p>{language.seller}</p>
					</S.SenderWrapper>
					<S.ReceiverWrapper>
						<p>{language.buyer}</p>
					</S.ReceiverWrapper>
					<S.QuantityWrapper className={'end-value header'}>
						<p className={'header'}>{language.quantity}</p>
					</S.QuantityWrapper>
					<S.PriceWrapper className={'end-value'}>
						<p>{language.price}</p>
					</S.PriceWrapper>
					<S.DateValueWrapper>
						<p>{language.time}</p>
					</S.DateValueWrapper>
				</S.TableHeader>
				<S.TableBody>
					{activityGroup.map((row: any, index: number) => {
						return (
							<S.TableRow key={index}>
								<S.AssetWrapper>
									{row.asset && row.asset.data && (
										<>
											<S.AssetDataWrapper>
												<Link to={`${URLS.asset}${row.dominantToken}`}>
													<AssetData asset={row.asset} />
												</Link>
											</S.AssetDataWrapper>
											<Link to={`${URLS.asset}${row.dominantToken}`}>
												<p>{row.asset.data.title || formatAddress(row.dominantToken, false)}</p>
											</Link>
										</>
									)}
									{!row.asset && (
										<Link to={`${URLS.asset}${row.dominantToken}`}>
											<p>{formatAddress(row.dominantToken, false)}</p>
										</Link>
									)}
								</S.AssetWrapper>
								<S.EventWrapper>
									<S.Event type={row.event} href={REDIRECTS.aoLink(row.orderId)} target="_blank">
										<ReactSVG src={getEventIcon(row.event)} />
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
											<p>{row.sender ? formatAddress(row.sender, false) : '-'}</p>
										</S.Entity>
									)}
								</S.SenderWrapper>
								<S.ReceiverWrapper>{getReceiverContent(row)}</S.ReceiverWrapper>
								<S.QuantityWrapper className={'end-value'}>
									<p>{getDenominatedTokenValue(row.quantity, row.dominantToken)}</p>
								</S.QuantityWrapper>
								<S.PriceWrapper className={'end-value'}>
									<CurrencyLine amount={row.price} currency={row.swapToken} callback={null} />
								</S.PriceWrapper>
								<S.DateValueWrapper>
									<p>{getRelativeDate(row.timestamp)}</p>
									{row.timestamp && (
										<S.DateValueTooltip>
											<ReactSVG src={ASSETS.info} />
											<div className={'date-tooltip fade-in border-wrapper-alt2'}>
												<p>{`${formatDate(row.timestamp, 'iso', true)}`}</p>
											</div>
										</S.DateValueTooltip>
									)}
								</S.DateValueWrapper>
							</S.TableRow>
						);
					})}
				</S.TableBody>
			</S.TableWrapper>
		);
	}, [activityGroup, updating, props.asset, props.assetIds]);

	return (
		<S.Wrapper className={'fade-in'} ref={scrollRef}>
			<S.Header>
				<h4>{`${language.interactions}${
					activity && activity.length ? ` (${formatCount(activity.length.toString())})` : ''
				}`}</h4>
				<S.HeaderActions>
					<S.SelectWrapper>
						<Select
							label={null}
							activeOption={activitySortType}
							setActiveOption={(option: SelectOptionType) => handleActivitySortType(option)}
							options={ACTIVITY_SORT_OPTIONS.map((option: SelectOptionType) => option)}
							disabled={!activityGroup || activityGroup.length <= 0 || updating}
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
