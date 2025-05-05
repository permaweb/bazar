import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import { AOSyncProvider } from '@vela-ventures/aosync-sdk-react';
import { PersistGate } from 'redux-persist/integration/react';

import { App } from 'app';
import { GlobalStyle } from 'app/styles';
import { AppProvider } from 'providers/AppProvider';
import { ArweaveProvider } from 'providers/ArweaveProvider';
import { CustomThemeProvider } from 'providers/CustomThemeProvider';
import ErrorBoundary from 'providers/ErrorBoundary';
import { LanguageProvider } from 'providers/LanguageProvider';
import { PermawebProvider } from 'providers/PermawebProvider';
import { persistor, store } from 'store';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<Provider store={store}>
		<PersistGate loading={null} persistor={persistor}>
			<CustomThemeProvider>
				<LanguageProvider>
					<ErrorBoundary>
						<AOSyncProvider
							gatewayConfig={{
								host: 'arweave.net',
								port: 443,
								protocol: 'https',
							}}
							appInfo={{ name: 'Bazar' }}
							muUrl="https://mu.ao-testnet.xyz"
						>
							<ArweaveProvider>
								<PermawebProvider>
									<AppProvider>
										<HashRouter>
											<GlobalStyle />
											<App />
										</HashRouter>
									</AppProvider>
								</PermawebProvider>
							</ArweaveProvider>
						</AOSyncProvider>
					</ErrorBoundary>
				</LanguageProvider>
			</CustomThemeProvider>
		</PersistGate>
	</Provider>
);
