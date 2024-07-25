import React from 'react';
// import { useSelector } from 'react-redux';
import { ReactSVG } from 'react-svg';

import { readHandler } from 'api';

import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Loader } from 'components/atoms/Loader';
import { AO, ASSETS } from 'helpers/config';
import { formatAddress, formatDate } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

// import { RootState } from 'store';
import * as S from './styles';
import { IProps } from './types';

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
			try {
				console.log('Fetching activity...');

				let data: any = {};
				if (props.assetIds) data.AssetIds = props.assetIds;
				if (props.address) data.Address = props.address;

				const response = await readHandler({
					processId: AO.ucm,
					action: 'Get-Activity',
					data: data,
				});

				if (response) {
					let updatedActivity = [];
					if (response.ListedOrders) updatedActivity.push(...mapActivity(response.ListedOrders, 'Listed'));
					if (response.ExecutedOrders) updatedActivity.push(...mapActivity(response.ExecutedOrders, 'Sold'));

					// const associatedAddresses = [];
					// if (props.asset && props.asset.state && props.asset.state.balances) {
					// 	associatedAddresses.push(...Object.keys(props.asset.state.balances).map((address: string) => address));
					// }
					// if (props.asset && props.asset.orders) {
					// 	associatedAddresses.push(...props.asset.orders.map((order: any) => order.creator));
					// }
					// if (associatedAddresses.length) {
					// 	const uniqueAddresses = [...new Set(associatedAddresses)];
					// 	try {
					// 		setAssociatedProfiles(await getRegistryProfiles({ profileIds: uniqueAddresses }));
					// 	} catch (e: any) {
					// 		console.error(e);
					// 	}
					// }

					setActivity(updatedActivity.sort((a, b) => b.timestamp - a.timestamp));
				}
			} catch (e: any) {
				console.error(e);
			}
		})();
	}, []);

	console.log(activity);

	const getActivity = React.useMemo(() => {
		if (!activity) {
			return <Loader sm relative />;
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
						<S.TableHeaderValue>
							<p>Event</p>
						</S.TableHeaderValue>
						<S.TableHeaderValue>
							<p>By</p>
						</S.TableHeaderValue>
						<S.TableHeaderValue>
							<p>To</p>
						</S.TableHeaderValue>
						<S.TableHeaderValue>
							<p>Quantity</p>
						</S.TableHeaderValue>
						<S.TableHeaderValue>
							<p>Price</p>
						</S.TableHeaderValue>
						<S.TableHeaderValue>
							<p>Date</p>
						</S.TableHeaderValue>
					</S.TableHeader>
					<S.TableBody>
						{activity.map((row: any) => (
							<S.TableRow key={row.orderId}>
								<S.TableRowValue>
									<S.Event type={row.event}>
										<ReactSVG src={row.event === 'Listed' ? ASSETS.orders : ASSETS.sell} />
										<p>{row.event}</p>
									</S.Event>
								</S.TableRowValue>
								<S.TableRowValue>
									<p>{formatAddress(row.sender, false)}</p>
								</S.TableRowValue>
								<S.TableRowValue>
									<p>{row.receiver ? formatAddress(row.receiver, false) : '-'}</p>
								</S.TableRowValue>
								<S.TableRowValue>
									<p>{row.quantity}</p>
								</S.TableRowValue>
								<S.TableRowValue>
									{/* <p>{row.price}</p> */}
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
