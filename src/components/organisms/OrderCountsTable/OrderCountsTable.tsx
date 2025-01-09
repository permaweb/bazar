import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getAndUpdateRegistryProfiles, readHandler } from 'api';

import { AO, ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { RegistryProfileType } from 'helpers/types';
import { checkValidAddress, formatAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';

export default function OrderCountsTable() {
	const profilesReducer = useSelector((state: RootState) => state.profilesReducer);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [topCreators, setTopCreators] = React.useState<RegistryProfileType[] | null>(null);
	const [topCollectors, setTopCollectors] = React.useState<RegistryProfileType[] | null>(null);

	React.useEffect(() => {
		(async function () {
			try {
				const response = await readHandler({
					processId: AO.ucmActivity,
					action: 'Get-Order-Counts-By-Address',
					tags: [{ name: 'Count', value: '5' }],
				});

				if (response) {
					if (response.SalesByAddress) {
						const topCreatorAddresses = Object.entries(response.SalesByAddress)
							.sort(([, countA], [, countB]) => Number(countB) - Number(countA))
							.slice(0, 5)
							.map(([address]) => address);
						setTopCreators(await getAndUpdateRegistryProfiles(topCreatorAddresses));
					}
					if (response.PurchasesByAddress) {
						const topCollectorAddresses = Object.entries(response.PurchasesByAddress)
							.sort(([, countA], [, countB]) => Number(countB) - Number(countA))
							.slice(0, 5)
							.map(([address]) => address);
						setTopCollectors(await getAndUpdateRegistryProfiles(topCollectorAddresses));
					}
				}
			} catch (e: any) {
				console.error(e);
			}
		})();
	}, [profilesReducer?.registryProfiles]);

	return (
		<S.Wrapper className={'fade-in'}>
			<S.Section>
				<S.Header>
					<h4>{language.topCreators}</h4>
				</S.Header>
				<S.ProfilesWrapper>
					{topCreators ? (
						topCreators.map((profile: RegistryProfileType, index: number) => {
							const hasImage = profile.thumbnail && checkValidAddress(profile.thumbnail);
							return (
								<S.ProfileWrapper key={index} className={'fade-in'}>
									<Link to={URLS.profileCollections(profile.id)}>
										<S.Avatar hasOwner={true} hasImage={hasImage}>
											{hasImage ? <img src={getTxEndpoint(profile.thumbnail)} /> : <ReactSVG src={ASSETS.user} />}
										</S.Avatar>
										<S.Username>
											<p>{profile.username ? profile.username : formatAddress(profile.id, false)}</p>
										</S.Username>
										<S.Bio>
											<span>
												{profile.description
													? profile.description.length > 40
														? `${profile.description.substring(0, 40)}...`
														: profile.description
													: language.noBio}
											</span>
										</S.Bio>
									</Link>
								</S.ProfileWrapper>
							);
						})
					) : (
						<>
							{Array.from({ length: 5 }, (_, i) => i + 1).map((index) => {
								return <S.ProfileWrapper key={index} className={'fade-in border-wrapper-alt1'} />;
							})}
						</>
					)}
				</S.ProfilesWrapper>
			</S.Section>
			<S.Section>
				<S.Header>
					<h4>{language.topCollectors}</h4>
				</S.Header>
				<S.ProfilesWrapper>
					{topCollectors ? (
						topCollectors.map((profile: RegistryProfileType, index: number) => {
							const hasImage = profile.thumbnail && checkValidAddress(profile.thumbnail);
							return (
								<S.ProfileWrapper key={index} className={'fade-in'}>
									<Link to={URLS.profileAssets(profile.id)}>
										<S.Avatar hasOwner={true} hasImage={hasImage}>
											{hasImage ? <img src={getTxEndpoint(profile.thumbnail)} /> : <ReactSVG src={ASSETS.user} />}
										</S.Avatar>
										<S.Username>
											<p>{profile.username ? profile.username : formatAddress(profile.id, false)}</p>
										</S.Username>
										<S.Bio>
											<span>
												{profile.description
													? profile.description.length > 40
														? `${profile.description.substring(0, 40)}...`
														: profile.description
													: language.noBio}
											</span>
										</S.Bio>
									</Link>
								</S.ProfileWrapper>
							);
						})
					) : (
						<>
							{Array.from({ length: 5 }, (_, i) => i + 1).map((index) => {
								return <S.ProfileWrapper key={index} className={'fade-in border-wrapper-alt1'} />;
							})}
						</>
					)}
				</S.ProfilesWrapper>
			</S.Section>
		</S.Wrapper>
	);
}
