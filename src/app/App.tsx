import { DOM } from 'helpers/config';
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
				<S.View>
					<Routes />
				</S.View>
			</S.AppWrapper>
		</>
	);
}
