import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { ASSETS, URLS } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { WalletConnect } from 'wallet/WalletConnect';

import * as S from './styles';

export default function Header() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const paths: { path: string; label: string }[] = [
		{ path: URLS.collections, label: language.collections },
		{ path: URLS.docs, label: language.learn },
	];

	return (
		<S.Wrapper>
			<S.Content className={'max-view-wrapper'}>
				<S.LogoWrapper>
					<Link to={URLS.base}>
						<ReactSVG src={ASSETS.logo} />
					</Link>
				</S.LogoWrapper>
				<S.ActionsWrapper>
					<S.NavWrapper>
						{paths.map((element: { path: string; label: string }, index: number) => {
							return <Link key={index} to={element.path}>{element.label}</Link>;
						})}
					</S.NavWrapper>
					<WalletConnect />
				</S.ActionsWrapper>
			</S.Content>
		</S.Wrapper>
	);
}
