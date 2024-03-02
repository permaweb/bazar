import { ASSETS } from 'helpers/config';

import * as S from './styles';
import { IProps } from './types';

export default function Checkbox(props: IProps) {
	return (
		<S.Input
			image={ASSETS.checkmark}
			checked={props.checked}
			disabled={props.disabled}
			type={'checkbox'}
			onChange={props.handleSelect}
		/>
	);
}
