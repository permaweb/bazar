import { ArrowUpRight } from 'lucide-react';

import type { AssetState } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { Icon } from 'components/atoms/Icon';
import { transactionExplorerUrl } from 'helpers/explorer';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleTokenIdentity } from '../../../model/fungible-market-view';

import * as S from './styles';

export default function FungibleAboutPanel(props: {
	assetId: string;
	identity: FungibleTokenIdentity;
	state: AssetState;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	return (
		<>
			<S.Description className="asset-description">{props.identity.description}</S.Description>
			<S.Facts className="asset-detail-facts">
				<div>
					<span>{messages.aboutTicker}</span>
					<strong>{props.identity.tickerDisplay}</strong>
				</div>
				<div>
					<span>{messages.aboutTotalSupply}</span>
					<strong>{tokenLabel(props.state.totalSupply, props.state)}</strong>
				</div>
				<div>
					<span>{messages.aboutAtomicPrecision}</span>
					<strong>
						{formatMessage(messages.fungibleDecimals, { denomination: props.state.denomination })}
					</strong>
				</div>
				<div>
					<span>{messages.aboutSettlement}</span>
					<strong>
						<ArCurrencyLabel />
					</strong>
				</div>
			</S.Facts>
			<S.AboutRights className="asset-about-rights" aria-labelledby="fungible-about-rights-title">
				<h2 id="fungible-about-rights-title">{messages.aboutUsageRights}</h2>
				{props.identity.license.length ? (
					<S.LicenseProperties className="license-properties">
						{props.identity.license.map((property) => (
							<div key={property.key}>
								<dt>{property.label}</dt>
								<dd>{property.value}</dd>
							</div>
						))}
						<div className="license-proof">
							<dt>{messages.aboutLicenseProof}</dt>
							<dd>
								<a href={transactionExplorerUrl(props.assetId)} target="_blank" rel="noreferrer">
									{messages.aboutLicenseProofLink} <Icon icon={ArrowUpRight} size="xs" />
								</a>
							</dd>
						</div>
					</S.LicenseProperties>
				) : (
					<S.EmptyCopy className="asset-empty-copy">{messages.aboutLicenseEmpty}</S.EmptyCopy>
				)}
				<S.MarketNote className="market-note">{messages.aboutLicenseNote}</S.MarketNote>
			</S.AboutRights>
		</>
	);
}
