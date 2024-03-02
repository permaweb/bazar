import { DOM } from 'helpers/config';
import { Footer } from 'navigation/footer';
import { Header } from 'navigation/Header';
import { Routes } from 'routes';

import * as S from './styles';

export default function App() {
	return (
		<>
			<div id={DOM.loader} />
			<div id={DOM.notification} />
			<div id={DOM.overlay} />
			<S.AppWrapper>
				<Header />
				<S.View className={'max-view-wrapper'}>
					<Routes />
				</S.View>
				<Footer />
			</S.AppWrapper>
		</>
	);
}
