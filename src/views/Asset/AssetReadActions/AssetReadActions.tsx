import { IconButton } from 'components/atoms/IconButton';
import { ASSETS } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function AssetReadActions(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	return (
		<S.Wrapper>
			<IconButton
				type={'alt1'}
				src={ASSETS.close}
				handlePress={() => props.toggleViewType()}
				dimensions={{
					wrapper: 27.5,
					icon: 12.5,
				}}
				tooltip={language.return}
				useBottomToolTip
			/>
		</S.Wrapper>
	);
}
