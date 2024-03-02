import { ReactSVG } from 'react-svg';

import { APP, ASSETS, REDIRECTS } from 'helpers/config';

import * as S from './styles';

export default function Footer() {
	const socialPaths = [{ icon: ASSETS.x, href: REDIRECTS.x }];

	return (
		<S.Wrapper className={'max-view-wrapper'}>
			<S.Container>
				<S.Content>{`${APP.name} ${new Date().getFullYear()}`}</S.Content>
				<S.EWrapper>
					{socialPaths.map((path, index) => (
						<a key={index} target={'_blank'} rel={'noreferrer'} href={path.href}>
							<ReactSVG src={path.icon} />
						</a>
					))}
				</S.EWrapper>
			</S.Container>
		</S.Wrapper>
	);
}
