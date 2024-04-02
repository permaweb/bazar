import React from 'react';

import { formatCount } from 'helpers/utils';

import * as S from './styles';
import { IProps } from './types';

export default function Slider(props: IProps) {
	const rangeRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		const rangeElement = rangeRef.current;

		const handleWheel = (e: any) => {
			if (e) e.preventDefault();
		};

		rangeElement.addEventListener('wheel', handleWheel, { passive: false });

		return () => {
			rangeElement.removeEventListener('wheel', handleWheel);
		};
	}, []);

	return (
		<S.Wrapper>
			{props.label && (
				<S.LabelWrapper>
					<S.Label>
						<p>{props.label}</p>
					</S.Label>
					<S.Value>
						<p>{`(${formatCount(props.value.toString())} / ${formatCount(props.maxValue.toString())})`}</p>
					</S.Value>
				</S.LabelWrapper>
			)}
			<S.Input
				ref={rangeRef}
				className={'custom-range'}
				type={'range'}
				min={props.minValue ? props.minValue.toString() : '0'}
				max={props.maxValue.toString()}
				step={'1'}
				value={props.value.toString()}
				onChange={props.handleChange}
				disabled={props.disabled}
				onWheel={(e) => e.preventDefault()}
			/>
		</S.Wrapper>
	);
}
