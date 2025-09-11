import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getAssetsByIds, getProfiles, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { IconButton } from 'components/atoms/IconButton';
import { Select } from 'components/atoms/Select';
import { OwnerLine } from 'components/molecules/OwnerLine';
import {
	ACTIVITY_SORT_OPTIONS,
	AO,
	ASSETS,
	getDefaultToken,
	HB,
	REDIRECTS,
	REFORMATTED_ASSETS,
	URLS,
} from 'helpers/config';
import { FormattedActivity, GqlEdge, SelectOptionType } from 'helpers/types';
import { checkValidAddress, formatAddress, formatCount, formatDate, getRelativeDate, isFirefox } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';

import { AssetData } from '../AssetData';

import * as S from './styles';
import { IProps } from './types';

const GROUP_COUNT = 50;

// Spam address to filter out from Recent Activity
const SPAM_ADDRESS = 'DwYZmjS7l6NHwojaH7-LzRBb4RiwjshGQm7-1ApDObw';

export default function ActivityTable(props: IProps) {
	const profilesReducer = useSelector((state: RootState) => state.profilesReducer);

	const permawebProvider = usePermawebProvider();

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
			if (props.activityId) {
				if (checkValidAddress(props.activityId)) {
					try {
						const response = await permawebProvider.libs.readState({
							processId: props.activityId,
							path: 'activity',
							fallbackAction: 'Info',
							node: HB.defaultNode,
						});

						if (response) setActivityResponse(response);
						else {
							setActivity([]);
							setActivityGroup([]);
							setActivityGroups([]);
						}
					} catch (e: any) {
						console.error(e);
						setActivity([]);
						setActivityGroup([]);
						setActivityGroups([]);
					}
				} else {
					setActivity([]);
					setActivityGroup([]);
					setActivityGroups([]);
				}
			} else {
				try {
					const gqlArgs: any = {
						tags: [
							{ name: 'Action', values: ['Order-Success'] },
							{ name: 'Status', values: ['Success'] },
							{ name: 'Handler', values: ['Create-Order'] },
							{ name: 'Data-Protocol', values: ['ao'] },
							{ name: 'Type', values: ['Message'] },
							{ name: 'Variant', values: ['ao.TN.1'] },
						],
					};

					let gqlFetch;
					if (props.address) {
						gqlFetch = permawebProvider.libs.getAggregatedGQLData;
						gqlArgs.recipients = [props.address];
					} else {
						gqlFetch = permawebProvider.libs.getGQLData;
					}

					const gqlResponse = await gqlFetch(gqlArgs);

					const formatted = transformGqlResponse(props.address ? gqlResponse : gqlResponse.data);
					setActivityResponse(formatted);
				} catch (e: any) {
					console.error(e);
					setActivity([]);
					setActivityGroup([]);
					setActivityGroups([]);
				}
			}
		})();
	}, [props.activityId, props.address]);

	React.useEffect(() => {
		if (activityResponse) {
			let updatedActivity = [];
			if (activityResponse.ListedOrders) updatedActivity.push(...mapActivity(activityResponse.ListedOrders, 'Listing'));
			if (activityResponse.ExecutedOrders)
				updatedActivity.push(...mapActivity(activityResponse.ExecutedOrders, 'Sale'));
			if (activityResponse.CancelledOrders)
				updatedActivity.push(...mapActivity(activityResponse.CancelledOrders, 'Unlisted'));
			setActivity(updatedActivity);
			if (updatedActivity.length <= 0) {
				setActivityGroup([]);
				setActivityGroups([]);
			}
		}
	}, [activityResponse, permawebProvider.profile]);

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
						associatedAddresses.push(...currentGroup.map((order: any) => order.sender));
						associatedAddresses.push(...currentGroup.map((order: any) => order.receiver));

						let associatedProfiles: any[] | null = null;
						const uniqueAddresses = [...new Set(associatedAddresses.filter((address) => address !== null))];
						associatedProfiles = await getProfiles(uniqueAddresses);

						if (associatedProfiles) {
							currentGroup = currentGroup.map((order: any) => {
								return {
									...order,
									senderProfile: associatedProfiles.find((profile: any) => profile.id === order.sender),
									receiverProfile: associatedProfiles.find((profile: any) => profile.id === order.receiver),
								};
							});
						}

						if (!props.asset) {
							const uniqueAssetIds: any[] = [...new Set(currentGroup.map((order: any) => order.dominantToken))];
							try {
								const assets = await getAssetsByIds({
									ids: uniqueAssetIds,
									sortType: 'recently-listed',
								});
								if (assets && assets.length > 0) {
									currentGroup = currentGroup.map((order: any) => {
										const asset = assets.find((asset: any) => asset.data.id === order.dominantToken);
										return {
											...order,
											asset: asset,
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
	}, [activityGroups, activityCursor, props.address, profilesReducer?.registryProfiles]);

	function transformGqlResponse(edges: GqlEdge[]): FormattedActivity {
		const out: FormattedActivity = {
			ListedOrders: [],
			PurchasesByAddress: {},
			TotalVolume: {},
			SalesByAddress: {},
			CancelledOrders: [],
			ExecutedOrders: [],
		};

		const swapTokens = [getDefaultToken().id];
		let spamFilteredCount = 0;

		for (const { node } of edges) {
			const t = node.tags.reduce<Record<string, string>>((m, { name, value }) => {
				m[name] = value;
				return m;
			}, {});

			// Spam filtering logic (debug logs removed)

			// Spam detection logic (debug logs removed for cleaner console)

			// Filter out activities from spam address
			// Check multiple fields where the spam address might appear
			const isSpamActivity =
				node.recipient === SPAM_ADDRESS ||
				t['Sender'] === SPAM_ADDRESS ||
				t['From-Process'] === SPAM_ADDRESS ||
				t['Recipient'] === SPAM_ADDRESS ||
				t['To-Process'] === SPAM_ADDRESS ||
				t['Owner'] === SPAM_ADDRESS ||
				t['Creator'] === SPAM_ADDRESS;

			// Additional filter: Check if this is a spam activity based on very low denomination values
			// Spam collections often have extremely low prices that aren't visible in UI
			const price = t['Price'];
			const isLowDenominationSpam = price && price === 'None'; // Only filter out "None" prices, not "0" or small values

			// Check if this looks like emoji/animal spam based on asset data
			// Only filter if we have strong evidence it's spam
			const isEmojiAnimalSpam =
				t['Message'] &&
				// Only filter if the message contains multiple emojis (spam pattern)
				((t['Message'].includes('🐙') && t['Message'].includes('🦑')) || // Octopus + squid pattern
					(t['Message'].includes('🐬') && t['Message'].includes('🐋')) || // Dolphin + whale pattern
					// Or if it contains very specific spam patterns
					t['Message'].includes('🐙🦑') ||
					t['Message'].includes('🐬🐋'));

			if (isSpamActivity || isLowDenominationSpam || isEmojiAnimalSpam) {
				spamFilteredCount++;
				// Spam filtering (debug logs removed for cleaner console)
				continue;
			}

			const tsMs = node?.block?.timestamp ? node.block.timestamp * 1000 : '-';
			const action = t['Action'];

			if (action === 'Order-Success') {
				let order: any = {
					OrderId: node.id,
					Timestamp: tsMs,
					Quantity: t['Quantity'],
					Price: t['Price'],
				};

				if (swapTokens.includes(t['DominantToken'])) {
					order.Receiver = props.address ?? node.recipient;
					order.DominantToken = t['SwapToken'];
					order.SwapToken = t['DominantToken'];
					order.Sender = t['Sender'] ?? t['From-Process'];
					out.ExecutedOrders.push(order);
					out.PurchasesByAddress[node.recipient] = (out.PurchasesByAddress[node.recipient] || 0) + 1;
				} else {
					order.Sender = node.recipient;
					order.DominantToken = t['DominantToken'];
					order.SwapToken = t['SwapToken'];

					out.ListedOrders.push(order);
					out.SalesByAddress[node.recipient] = (out.SalesByAddress[node.recipient] || 0) + 1;
				}
			} else if (action === 'Cancel-Order') {
				out.CancelledOrders.push(node.id);
			}
		}

		// Spam filtering summary (debug logs removed for cleaner console)
		return out;
	}

	const handleActivitySortType = React.useCallback((option: SelectOptionType) => {
		setActivityGroup(null);
		setActivityGroups(null);
		setActivitySortType(option);
	}, []);

	function mapActivity(orders: any, event: 'Listing' | 'Purchase' | 'Sale' | 'Unlisted') {
		let updatedActivity = [];

		if (orders && orders.length > 0) {
			const mappedActivity = orders.map((order: any) => {
				let orderEvent = event;
				if (
					order.Receiver &&
					((props.address && order.Receiver === props.address) || permawebProvider.profile?.id === order.Receiver)
				) {
					orderEvent = 'Purchase';
				}
				return {
					orderId: order.OrderId,
					dominantToken: order.DominantToken,
					swapToken: order.SwapToken,
					price: order.Price ? order.Price.toString() : '-',
					quantity: order.Quantity ? order.Quantity.toString() : '-',
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

	const start = activity && activity.length ? Number(activityCursor) * groupCount + 1 : '';
	const end = activity && activity.length ? Math.min((Number(activityCursor) + 1) * groupCount, activity.length) : '';

	const getReceiverContent = React.useMemo(
		() => (row: any) => {
			if (row.receiverProfile) {
				if (row.receiverProfile.id === props.asset?.orderbook?.id) {
					return (
						<S.Entity type={'UCM'} href={REDIRECTS.explorer(row.receiverProfile.id)} target={'_blank'}>
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
					<S.Entity type={'User'} href={REDIRECTS.explorer(row.receiver)} target={'_blank'}>
						<p>{formatAddress(row.receiver, false)}</p>
					</S.Entity>
				);
			}
			return <p>-</p>;
		},
		[props.asset?.orderbook?.id]
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
					{!props.asset && (
						<S.AssetWrapper>
							<p>{language.asset}</p>
						</S.AssetWrapper>
					)}
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
						const shouldShowAsset = !props.asset && row.asset && row.asset.data;
						return (
							<S.TableRow key={index}>
								{shouldShowAsset && (
									<S.AssetWrapper>
										<S.AssetDataWrapper>
											<Link to={`${URLS.asset}${row.asset.data.id}`}>
												<AssetData asset={row.asset} preview autoLoad />
											</Link>
										</S.AssetDataWrapper>
										<Link to={`${URLS.asset}${row.asset.data.id}`}>
											<p>{row.asset.data.title || formatAddress(row.asset.data.id, false)}</p>
										</Link>
									</S.AssetWrapper>
								)}
								<S.EventWrapper>
									<S.Event type={row.event} href={REDIRECTS.explorer(row.orderId)} target={'_blank'}>
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
										<S.Entity type={'User'} href={REDIRECTS.explorer(row.sender)} target={'_blank'}>
											<p>{row.sender ? formatAddress(row.sender, false) : '-'}</p>
										</S.Entity>
									)}
								</S.SenderWrapper>
								<S.ReceiverWrapper>{getReceiverContent(row)}</S.ReceiverWrapper>
								<S.QuantityWrapper className={'end-value'}>
									<p>{getDenominatedTokenValue(row.quantity, row.dominantToken)}</p>
								</S.QuantityWrapper>
								<S.PriceWrapper className={'end-value'}>
									{!isNaN(Number(row.price)) ? (
										<CurrencyLine amount={row.price} currency={row.swapToken} callback={null} />
									) : (
										<p>-</p>
									)}
								</S.PriceWrapper>
								<S.DateValueWrapper>
									{row.timestamp !== '-' ? (
										<>
											<p>{getRelativeDate(row.timestamp)}</p>
											<S.DateValueTooltip>
												<ReactSVG src={ASSETS.info} />
												<div className={'date-tooltip fade-in border-wrapper-alt2'}>
													<p>{`${formatDate(row.timestamp, 'iso', true)}`}</p>
												</div>
											</S.DateValueTooltip>
										</>
									) : (
										<p>-</p>
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
