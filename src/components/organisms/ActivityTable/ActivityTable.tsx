import React from 'react';
// import { useSelector } from 'react-redux';
import { ReactSVG } from 'react-svg';

import { getRegistryProfiles, readHandler } from 'api';

import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Loader } from 'components/atoms/Loader';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { AO, ASSETS } from 'helpers/config';
import { RegistryProfileType } from 'helpers/types';
import { formatAddress, formatCount, formatDate } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

// import { RootState } from 'store';
import * as S from './styles';
import { IProps } from './types';

// TODO: quantity denomination
// TODO: mobile
// TODO: profile / collection activity
export default function ActivityTable(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [activity, setActivity] = React.useState<any>(null);

	function mapActivity(orders: any, event: 'Listed' | 'Sold') {
		let updatedActivity = [];

		if (orders && orders.length > 0) {
			const mappedActivity = orders.map((order: any) => {
				return {
					orderId: order.OrderId,
					dominantToken: order.DominantToken,
					swapToken: order.SwapToken,
					price: order.Price.toString(),
					quantity: order.Quantity.toString(),
					sender: order.Sender || null,
					receiver: order.Receiver || null,
					timestamp: order.Timestamp,
					event: event,
				};
			});

			updatedActivity = mappedActivity;
		}

		return updatedActivity;
	}

	React.useEffect(() => {
		(async function () {
			if (!activity) {
				try {
					let data: any = {};
					console.log(props.assetIds);
					if (props.assetIds) data.AssetIds = props.assetIds;
					if (props.address) data.Address = props.address;

					const response = await readHandler({
						processId: AO.ucm,
						action: 'Get-Activity',
						data: data,
					});

					if (response) {
						let updatedActivity = [];
						const associatedAddresses = [];

						if (response.ListedOrders) updatedActivity.push(...mapActivity(response.ListedOrders, 'Listed'));
						if (response.ExecutedOrders) updatedActivity.push(...mapActivity(response.ExecutedOrders, 'Sold'));

						if (updatedActivity.length > 0) {
							associatedAddresses.push(...updatedActivity.map((order: any) => order.sender));
							associatedAddresses.push(...updatedActivity.map((order: any) => order.receiver));
						}

						let associatedProfiles: RegistryProfileType[] | null = null;
						const uniqueAddresses = [...new Set(associatedAddresses.filter((address) => address !== null))];
						try {
							associatedProfiles = await getRegistryProfiles({ profileIds: uniqueAddresses });
						} catch (e: any) {
							console.error(e);
						}

						if (associatedProfiles) {
							updatedActivity = updatedActivity.map((order: any) => {
								return {
									...order,
									senderProfile: associatedProfiles.find((profile: RegistryProfileType) => profile.id === order.sender),
									receiverProfile: associatedProfiles.find(
										(profile: RegistryProfileType) => profile.id === order.receiver
									),
								};
							});
						}

						setActivity(updatedActivity.sort((a, b) => b.timestamp - a.timestamp));
					}
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.assetIds, props.address]);

	function getDenominatedTokenValue(amount: number) {
		if (props.asset && props.asset.state && props.asset.state.denomination && props.asset.state.denomination > 1) {
			const denomination = props.asset.state.denomination;
			console.log(denomination);
			return `${formatCount((amount / Math.pow(10, denomination)).toString())}`;
		} else return formatCount(amount.toString());
	}

	const getActivity = React.useMemo(() => {
		if (!activity) {
			return (
				<S.LoadingWrapper className={'border-wrapper-alt2'}>
					<Loader sm relative />
				</S.LoadingWrapper>
			);
		}

		if (activity.length <= 0) {
			return (
				<S.EmptyWrapper className={'border-wrapper-alt2'}>
					<span>{language.noActivity}</span>
				</S.EmptyWrapper>
			);
		}

		return (
			<S.Wrapper className={'fade-in'}>
				<S.TableWrapper className={'border-wrapper-primary'}>
					<S.TableHeader>
						<S.EventWrapper>
							<p>Event</p>
						</S.EventWrapper>
						<S.OwnerWrapper>
							<p>By</p>
						</S.OwnerWrapper>
						<S.OwnerWrapper>
							<p>To</p>
						</S.OwnerWrapper>
						<S.TableHeaderValue className={'center-value'}>
							<p>Quantity</p>
						</S.TableHeaderValue>
						<S.TableHeaderValue className={'end-value'}>
							<p>Price</p>
						</S.TableHeaderValue>
						<S.TableHeaderValue>
							<p>Date</p>
						</S.TableHeaderValue>
					</S.TableHeader>
					<S.TableBody>
						{activity.map((row: any, index: number) => (
							<S.TableRow key={index}>
								<S.EventWrapper>
									<S.Event type={row.event}>
										<ReactSVG src={row.event === 'Listed' ? ASSETS.orders : ASSETS.sell} />
										<p>{row.event}</p>
									</S.Event>
								</S.EventWrapper>
								<S.OwnerWrapper>
									{row.senderProfile ? (
										<OwnerLine
											owner={{
												address: row.sender,
												profile: row.senderProfile,
											}}
											callback={null}
										/>
									) : (
										<p>{formatAddress(row.sender, false)}</p>
									)}
								</S.OwnerWrapper>
								<S.OwnerWrapper>
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
								</S.OwnerWrapper>
								<S.TableRowValue className={'center-value'}>
									<p>{getDenominatedTokenValue(row.quantity)}</p>
								</S.TableRowValue>
								<S.TableRowValue className={'end-value'}>
									<CurrencyLine amount={row.price} currency={row.swapToken} callback={null} />
								</S.TableRowValue>
								<S.TableRowValue>
									<p>{formatDate(row.timestamp, 'iso')}</p>
								</S.TableRowValue>
							</S.TableRow>
						))}
					</S.TableBody>
				</S.TableWrapper>
			</S.Wrapper>
		);
	}, [activity]);

	return getActivity;
}
