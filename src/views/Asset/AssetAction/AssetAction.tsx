import { Link } from 'react-router-dom';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { ASSETS, REDIRECTS } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function AssetAction(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	return props.asset ? (
		<S.Wrapper>
			<S.Header className={'border-wrapper-primary'}>
				<h4>{props.asset.data.title}</h4>
				<S.ACLink>
					<Link target={'_blank'} to={REDIRECTS.viewblock(props.asset.data.id)}>
						{language.viewblock}
					</Link>
				</S.ACLink>
			</S.Header>
		</S.Wrapper>
	) : null;
}
