import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, LoaderCircle } from 'lucide-react';

import type { Collection } from 'api/collections';

import { LiveRegion } from 'components/atoms/LiveRegion';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';
import type { CollectionLiveListingRow } from '../../../model/collection-market';
import * as Analytics from '../../../styles/analytics';

import * as S from './styles';

export default function CollectionAnalyticsPanel(props: {
	collection: Collection;
	loading: boolean;
	rows: CollectionLiveListingRow[];
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	return (
		<Analytics.Panel className="collection-analytics" aria-label={language.analyticsLabel}>
			<Analytics.Heading className="collection-analytics-heading">
				<div>
					<span>{language.analyticsEyebrow}</span>
					<h2>{language.analyticsHeading}</h2>
				</div>
				<BarChart3 aria-hidden="true" />
			</Analytics.Heading>
			<Analytics.Tabs className="collection-analytics-tabs">
				<span>{language.analyticsLiveOffersTab}</span>
			</Analytics.Tabs>
			{props.loading && !props.rows.length ? (
				<S.Empty className="collection-analytics-empty">
					<LoaderCircle className="spin" aria-hidden="true" />
					<strong>{language.checkingLiveOffers}</strong>
					<p>{language.checkingLiveOffersDetail}</p>
				</S.Empty>
			) : props.rows.length ? (
				<S.Orderbook className="collection-orderbook">
					{props.loading ? <LiveRegion>{language.refreshingLiveOffers}</LiveRegion> : null}
					<div className="collection-orderbook-head" aria-hidden="true">
						<span>{language.orderbookPrice}</span>
						<span>{language.orderbookQuantity}</span>
						<span>{language.orderbookTotal}</span>
					</div>
					<ul aria-label={language.orderbookLiveOffers}>
						{props.rows.slice(0, 24).map((row, index) => (
							<li key={`${row.asset.id}:${row.price}:${index}`}>
								<Link
									style={{ '--order-depth': `${row.depth}%` } as React.CSSProperties}
									to={`/asset/${props.collection.id}/${row.asset.id}`}
									title={row.asset.name}
								>
									<span>{row.price}</span>
									<span>{row.quantity}</span>
									<span>{row.total}</span>
									<VisuallyHidden>
										{formatMessage(language.orderbookCumulativeDepth, {
											percent: Math.round(row.depth),
										})}
									</VisuallyHidden>
								</Link>
							</li>
						))}
					</ul>
				</S.Orderbook>
			) : (
				<S.Empty className="collection-analytics-empty">
					<strong>{language.noLiveOffersTitle}</strong>
					<p>{language.noLiveOffersDetail}</p>
				</S.Empty>
			)}
		</Analytics.Panel>
	);
}
