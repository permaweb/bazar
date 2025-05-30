import React from 'react';

import ARNSMetadata from 'components/atoms/ARNSMetadata';
import { AssetDetailType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

interface IProps {
	asset: AssetDetailType;
}

export default function AssetDetail({ asset }: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	if (!asset) {
		return (
			<S.Wrapper role="status" aria-live="polite">
				<S.LoadingMessage>{language.loadingAsset}</S.LoadingMessage>
			</S.Wrapper>
		);
	}

	if (!asset.data) {
		return (
			<S.Wrapper role="alert" aria-live="assertive">
				<S.ErrorMessage>{language.errorLoadingAsset}</S.ErrorMessage>
			</S.Wrapper>
		);
	}

	// Merge asset.data.arnsMetadata with processId and Owner if missing
	const arnsMetadata = asset.data.arnsMetadata
		? {
				...(asset.data.arnsMetadata as any),
				processId: (asset.data.arnsMetadata as any).processId || asset.data.id,
				Owner: (asset.data.arnsMetadata as any).Owner || asset.data.creator,
		  }
		: undefined;

	return (
		<S.Wrapper>
			<S.Header>
				<h1 id="asset-title">{asset.data.title}</h1>
				{asset.data.description && <S.Description id="asset-description">{asset.data.description}</S.Description>}
			</S.Header>

			<S.Content>
				{arnsMetadata && (
					<S.ARNSMetadataWrapper role="region" aria-labelledby="arns-metadata-title">
						<h2 id="arns-metadata-title" className="visually-hidden">
							{language.arnsMetadata}
						</h2>
						<ARNSMetadata metadata={arnsMetadata} />
					</S.ARNSMetadataWrapper>
				)}
			</S.Content>
		</S.Wrapper>
	);
}
