import type { AssetState, SwapOrder } from 'api/marketplace';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { WalletIdentity } from 'components/organisms/WalletAddress';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { orderPriceLabel, tokenLabel } from '../../../model/fungible-market';
import { fungibleListingAccessibleLabel } from '../../../model/fungible-operation';

import * as S from './styles';

export default function MatchedListingsReview(props: {
	onRemove?(order: SwapOrder): void;
	orders: SwapOrder[];
	state: AssetState;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const plural = usePlural();
	return (
		<S.Listings aria-label={messages.matchedListingsLabel} className="matched-listings">
			<S.Heading className="matched-listings-heading">
				<strong>{messages.matchedListingsHeading}</strong>
				<span>{plural(messages.matchedListingsCount, props.orders.length)}</span>
			</S.Heading>
			{props.orders.length ? (
				<ul aria-label={messages.matchedListingsSellers} tabIndex={props.orders.length > 4 ? 0 : undefined}>
					{props.orders.map((order) => (
						<li key={order.orderId}>
							<span>
								<strong>{tokenLabel(order.quantity, props.state)}</strong>
								<small>
									<ArCurrencyText>
										{formatMessage(messages.matchedListingsLot, {
											price: orderPriceLabel(order, props.state),
											total: winstonToArDecimal(order.asking),
										})}
									</ArCurrencyText>
								</small>
							</span>
							<WalletIdentity address={order.creator} />
							{props.onRemove ? (
								<Button
									aria-label={formatMessage(messages.matchedListingsRemoveLabel, {
										listing: fungibleListingAccessibleLabel(order, props.state, messages),
									})}
									onClick={() => props.onRemove?.(order)}
									size="custom"
									type="button"
									variant="danger"
								>
									{messages.matchedListingsRemove}
								</Button>
							) : null}
						</li>
					))}
				</ul>
			) : (
				<S.Empty className="matched-listings-empty">{messages.matchedListingsEmpty}</S.Empty>
			)}
		</S.Listings>
	);
}
