import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './app/App';
import { GlobalStyle } from './app/styles';
import { scheduleIdleTask } from './helpers/idle';
import { LanguageProvider } from './providers/LanguageProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { WalletProvider } from './providers/WalletProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeProvider>
			<GlobalStyle />
			<LanguageProvider>
				<WalletProvider>
					<App />
				</WalletProvider>
			</LanguageProvider>
		</ThemeProvider>
	</React.StrictMode>
);

scheduleIdleTask(() => {
	void import('./helpers/serviceWorker')
		.then(({ registerServiceWorker }) => registerServiceWorker())
		.catch(() => undefined);
});
