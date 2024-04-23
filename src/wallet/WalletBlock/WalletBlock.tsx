import { ReactSVG } from 'react-svg';

import { Button } from 'components/atoms/Button';
import { ASSETS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function WalletBlock() {
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	return (
		<S.Wrapper>
			<S.Icon>
				<ReactSVG src={ASSETS.wallet} />
			</S.Icon>
			<p>{language.connectToContinue}</p>
			<Button type={'alt1'} label={language.connect} handlePress={() => arProvider.setWalletModalVisible(true)} />
		</S.Wrapper>
	);
}
