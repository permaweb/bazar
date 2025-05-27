import React from 'react';

import * as S from './styles';
import { ARNSTokenInfo } from './types';

export interface ARNSMetadataProps {
	metadata: ARNSTokenInfo;
}

const ARNSMetadata: React.FC<ARNSMetadataProps> = ({ metadata }) => {
	const { Name, Ticker, Owner, Description, Logo, Keywords = [] } = metadata;

	return (
		<S.Card>
			<S.CardContent>
				<S.Container>
					<S.Row>
						{Logo && <S.Logo src={`https://arweave.net/${Logo}`} alt={`${Name} logo`} />}
						<div>
							<S.Name>{Name}</S.Name>
							<S.Ticker>Ticker: {Ticker}</S.Ticker>
							<S.Owner>Owner: {Owner}</S.Owner>
						</div>
					</S.Row>
					{Description && <S.Description>{Description}</S.Description>}
					{Keywords.length > 0 && (
						<S.KeywordList>
							{Keywords.map((keyword, index) => (
								<S.Badge key={index}>{keyword}</S.Badge>
							))}
						</S.KeywordList>
					)}
				</S.Container>
			</S.CardContent>
		</S.Card>
	);
};

export default ARNSMetadata;
