import { useMessages } from 'providers/LanguageProvider';

import { FOOTER_MESSAGES } from './messages';
import * as S from './styles';

export default function Footer() {
	const language = useMessages(FOOTER_MESSAGES);
	const [attributionLead, attributionTrail] = language.footerAttribution.split('{provider}');
	return (
		<S.Wrapper className="site-footer">
			<S.Content className="site-footer-content max-view-wrapper">
				<span>{language.footerProduct}</span>
				<span>
					{attributionLead}
					<a href="https://www.tradingview.com/" rel="noreferrer" target="_blank">
						{language.footerChartProvider}
					</a>
					{attributionTrail}
				</span>
			</S.Content>
		</S.Wrapper>
	);
}
