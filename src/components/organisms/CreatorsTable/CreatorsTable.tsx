import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { RegistryProfileType } from 'helpers/types';
import { checkValidAddress, formatAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

// TODO: get top creators
export default function CreatorsTable() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const profiles = [
		{
			id: 'wtS8fY00Xh4eYTORXI49loingAgMd8idBn4rP6e-8RM',
			username: 'Profile A',
			avatar: null,
			bio: null,
		},
		{
			id: 'wtS8fY00Xh4eYTORXI49loingAgMd8idBn4rP6e-8RM',
			username: 'Profile B',
			avatar: null,
			bio: null,
		},
		{
			id: 'wtS8fY00Xh4eYTORXI49loingAgMd8idBn4rP6e-8RM',
			username: 'Profile C',
			avatar: null,
			bio: null,
		},
		{
			id: 'wtS8fY00Xh4eYTORXI49loingAgMd8idBn4rP6e-8RM',
			username: 'Profile D',
			avatar: null,
			bio: null,
		},
		{
			id: 'wtS8fY00Xh4eYTORXI49loingAgMd8idBn4rP6e-8RM',
			username: 'Profile E',
			avatar: null,
			bio: null,
		},
	];

	return profiles ? (
		<S.Wrapper>
			<S.Header>
				<h4>{language.topCreators}</h4>
			</S.Header>
			<S.CreatorsWrapper className={'border-wrapper-alt2'}>
				{profiles.map((profile: RegistryProfileType, index: number) => {
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
											: 'No bio'}
									</span>
								</S.Bio>
							</Link>
						</S.CreatorWrapper>
					);
				})}
			</S.CreatorsWrapper>
		</S.Wrapper>
	) : null;
}
