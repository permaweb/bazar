import React from 'react';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { ASSETS } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function MetadataSection(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	if (!props.metadata) {
		return null;
	}

	const renderTraits = () => {
		const originalMetadata = props.metadata?.OriginalMetadata;
		if (!originalMetadata || !originalMetadata.attributes) {
			return null;
		}

		return (
			<S.TraitsGrid>
				{originalMetadata.attributes.map((trait: any, index: number) => (
					<S.TraitCard key={index}>
						<S.TraitType>{trait.trait_type}</S.TraitType>
						<S.TraitValue>{trait.value}</S.TraitValue>
					</S.TraitCard>
				))}
			</S.TraitsGrid>
		);
	};

	const renderTopics = () => {
		if (!props.metadata?.Topics || props.metadata.Topics.length === 0) {
			return null;
		}

		return (
			<S.TopicsWrapper>
				<S.SectionTitle>Topics</S.SectionTitle>
				<S.TopicsGrid>
					{props.metadata.Topics.map((topic: string, index: number) => (
						<S.TopicTag key={index}>{topic}</S.TopicTag>
					))}
				</S.TopicsGrid>
			</S.TopicsWrapper>
		);
	};

	return (
		<GS.DrawerWrapper>
			<Drawer
				title="Metadata"
				icon={ASSETS.info}
				content={
					<GS.DrawerContent>
						{renderTopics()}

						{props.metadata?.OriginalMetadata?.attributes && (
							<S.AttributesWrapper>
								<S.SectionTitle>Attributes</S.SectionTitle>
								{renderTraits()}
							</S.AttributesWrapper>
						)}
					</GS.DrawerContent>
				}
			/>
		</GS.DrawerWrapper>
	);
}
