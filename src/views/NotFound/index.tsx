import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function NotFound() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	return (
		<S.Wrapper>
			<S.Content>
				<S.Header>404</S.Header>
				<S.Divider />
				<S.Message>{language.pageNotFound}</S.Message>
			</S.Content>
		</S.Wrapper>
	);
}
