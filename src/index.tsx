import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import { PersistGate } from 'redux-persist/integration/react';

import { App } from 'app';
import { GlobalStyle } from 'app/styles';
import { ArweaveProvider } from 'providers/ArweaveProvider';
import { CustomThemeProvider } from 'providers/CustomThemeProvider';
import { LanguageProvider } from 'providers/LanguageProvider';
import { persistor, store } from 'store';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<Provider store={store}>
		<PersistGate loading={null} persistor={persistor}>
			<CustomThemeProvider>
				<LanguageProvider>
					<ArweaveProvider>
						<HashRouter>
							<GlobalStyle />
							<App />
						</HashRouter>
					</ArweaveProvider>
				</LanguageProvider>
			</CustomThemeProvider>
		</PersistGate>
	</Provider>
);
