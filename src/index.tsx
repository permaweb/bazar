import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'styled-components';

import { App } from './app/App';
import { theme } from './helpers/theme';
import { LanguageProvider } from './providers/LanguageProvider';
import { WalletProvider } from './providers/WalletProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeProvider theme={theme}>
			<LanguageProvider>
				<WalletProvider>
					<App />
				</WalletProvider>
			</LanguageProvider>
		</ThemeProvider>
	</React.StrictMode>
);
