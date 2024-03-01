import { DOM } from 'helpers/config';
import { Navigation } from 'navigation';

import * as S from './styles';

export default function App() {
	return (
		<>
			<div id={DOM.loader} />
			<div id={DOM.notification} />
			<div id={DOM.overlay} />
			<S.AppWrapper>
				<Navigation />
				<S.View>
					<div>AO Bazar</div>
				</S.View>
			</S.AppWrapper>
		</>
	);
}
