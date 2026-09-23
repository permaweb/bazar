import { useMessages } from 'providers/LanguageProvider';

import { FOOTER_MESSAGES } from './messages';

export default function Footer() {
	const language = useMessages(FOOTER_MESSAGES);
	const [attributionLead, attributionTrail] = language.footerAttribution.split('{provider}');
	return (
		<footer className="site-footer">
			<div className="site-footer-content max-view-wrapper">
				<span>{language.footerProduct}</span>
				<span>
					{attributionLead}
					<a href="https://www.tradingview.com/" rel="noreferrer" target="_blank">
						{language.footerChartProvider}
					</a>
					{attributionTrail}
				</span>
			</div>
		</footer>
	);
}
