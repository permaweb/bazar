import React from 'react';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getRegistryProfiles, readHandler } from 'api';

import { AO, ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { RegistryProfileType } from 'helpers/types';
import { checkValidAddress, formatAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function CreatorsTable() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [associatedProfiles, setAssociatedProfiles] = React.useState<RegistryProfileType[] | null>(null);

	React.useEffect(() => {
		(async function () {
			try {
				const response = await readHandler({
					processId: AO.ucmActivity,
					action: 'Get-Sales-By-Address',
				});

				if (response && response.SalesByAddress) {
					const topAddresses = Object.entries(response.SalesByAddress)
						.sort(([, countA], [, countB]) => Number(countB) - Number(countA))
						.slice(0, 5)
						.map(([address]) => address);
					setAssociatedProfiles(await getRegistryProfiles({ profileIds: topAddresses }));
				}
			} catch (e: any) {
				console.error(e);
			}
		})();
	}, []);

	return (
		<S.Wrapper className={'fade-in'}>
			<S.Header>
				<h4>{language.topCreators}</h4>
			</S.Header>
			<S.CreatorsWrapper className={'border-wrapper-alt2'}>
				{associatedProfiles ? (
					associatedProfiles.map((profile: RegistryProfileType, index: number) => {
						const hasImage = profile.avatar && checkValidAddress(profile.avatar);
						return (
							<S.CreatorWrapper key={index}>
								<Link to={URLS.profileCollections(profile.id)}>
									<S.Avatar hasOwner={true} hasImage={hasImage}>
										{hasImage ? <img src={getTxEndpoint(profile.avatar)} /> : <ReactSVG src={ASSETS.user} />}
									</S.Avatar>
									<S.Username>
										<p>{profile.username ? profile.username : formatAddress(profile.id, false)}</p>
									</S.Username>
									<S.Bio>
										<span>
											{profile.bio
												? profile.bio.length > 40
													? `${profile.bio.substring(0, 40)}...`
													: profile.bio
												: language.noBio}
										</span>
									</S.Bio>
								</Link>
							</S.CreatorWrapper>
						);
					})
				) : (
					<>
						{Array.from({ length: 5 }, (_, i) => i + 1).map((index) => {
							return <S.CreatorWrapper key={index} className={'fade-in border-wrapper-alt1'} />;
						})}
					</>
				)}
			</S.CreatorsWrapper>
		</S.Wrapper>
	);
}
