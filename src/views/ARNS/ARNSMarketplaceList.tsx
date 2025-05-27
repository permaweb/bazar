import React from 'react';
import { useNavigate } from 'react-router-dom';

import ARNSMetadata from 'components/atoms/ARNSMetadata';
import { Button } from 'components/atoms/Button';
import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { URLS } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

interface IProps {
	tokens: any[];
	loading: boolean;
}

export default function ARNSMarketplaceList({ tokens, loading }: IProps) {
	const navigate = useNavigate();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	if (loading) {
		return (
			<S.LoadingWrapper>
				<Loader />
			</S.LoadingWrapper>
		);
	}

	if (tokens.length === 0) {
		return (
			<S.EmptyWrapper>
				<p>{language.noARNSFound}</p>
			</S.EmptyWrapper>
		);
	}

	return (
		<S.ListWrapper>
			{tokens.map((token, index) => (
				<S.TokenCard key={index} className="border-wrapper-alt1">
					<ARNSMetadata metadata={token} />
					<S.ActionsWrapper>
						<Button
							type="primary"
							label={language.viewDetails}
							handlePress={() => navigate(`${URLS.asset}${token.ProcessId}`)}
						/>
						{token.forSale && (
							<Button
								type="alt1"
								label={language.buy}
								handlePress={() => navigate(`${URLS.asset}${token.ProcessId}?action=buy`)}
							/>
						)}
					</S.ActionsWrapper>
				</S.TokenCard>
			))}
		</S.ListWrapper>
	);
}
