import { ArrowUpRight } from 'lucide-react';

import type { AssetState } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { Icon } from 'components/atoms/Icon';
import { transactionExplorerUrl } from 'helpers/explorer';

import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleTokenIdentity } from '../../../model/fungible-market-view';

export default function FungibleAboutPanel(props: {
	assetId: string;
	identity: FungibleTokenIdentity;
	state: AssetState;
}) {
	return (
		<>
			<p className="asset-description">{props.identity.description}</p>
			<div className="asset-detail-facts">
				<div>
					<span>Ticker</span>
					<strong>{props.identity.tickerDisplay}</strong>
				</div>
				<div>
					<span>Total supply</span>
					<strong>{tokenLabel(props.state.totalSupply, props.state)}</strong>
				</div>
				<div>
					<span>Atomic precision</span>
					<strong>{props.state.denomination} decimals</strong>
				</div>
				<div>
					<span>Settlement</span>
					<strong>
						<ArCurrencyLabel />
					</strong>
				</div>
			</div>
			<section className="asset-about-rights" aria-labelledby="fungible-about-rights-title">
				<h2 id="fungible-about-rights-title">Usage rights</h2>
				{props.identity.license.length ? (
					<dl className="license-properties">
						{props.identity.license.map((property) => (
							<div key={property.key}>
								<dt>{property.label}</dt>
								<dd>{property.value}</dd>
							</div>
						))}
						<div className="license-proof">
							<dt>Proof</dt>
							<dd>
								<a href={transactionExplorerUrl(props.assetId)} target="_blank" rel="noreferrer">
									View license proof on ViewBlock <Icon icon={ArrowUpRight} size="xs" />
								</a>
							</dd>
						</div>
					</dl>
				) : (
					<p className="asset-empty-copy">No UDL terms declared.</p>
				)}
				<p className="market-note">
					Declared terms and effective UDL 0.2 defaults come from immutable process metadata.
				</p>
			</section>
		</>
	);
}
