import React from 'react';
import ReactDOM from 'react-dom/client';

import { scheduleIdleTask } from 'helpers/idle';
import { ThemeProvider } from 'providers/ThemeProvider';
import { WalletProvider } from 'providers/WalletProvider';

import './styles.css';

import { App } from './App';
import { GlobalStyle } from './styles';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<ThemeProvider>
			<GlobalStyle />
			<WalletProvider>
				<App />
			</WalletProvider>
		</ThemeProvider>
	</React.StrictMode>
);

scheduleIdleTask(() => {
	void import('helpers/serviceWorker')
		.then(({ registerServiceWorker }) => registerServiceWorker())
		.catch(() => undefined);
});
