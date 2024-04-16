import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';
import { SelectOptionType } from 'helpers/types';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';
import { IProps } from './types';

export default function Select(props: IProps) {
	const [active, setActive] = React.useState<boolean>(false);

	return props.options && props.activeOption ? (
		<CloseHandler active={active} disabled={!active || props.disabled} callback={() => setActive(false)}>
			<S.Wrapper>
				{props.label && (
					<S.Label disabled={props.disabled}>
						<span>{props.label}</span>
					</S.Label>
				)}
				<S.Dropdown active={active} disabled={props.disabled} onClick={() => setActive(!active)}>
					<span>{props.activeOption.label}</span>
					<ReactSVG src={ASSETS.arrow} />
				</S.Dropdown>
				{active && (
					<S.Options className={'border-wrapper-primary'}>
						{props.options.map((option: SelectOptionType, index: number) => {
							return (
								<S.Option
									key={index}
									active={option.id === props.activeOption.id}
									onClick={() => {
										props.setActiveOption(option);
										setActive(false);
									}}
								>
									{option.label}
								</S.Option>
							);
						})}
					</S.Options>
				)}
			</S.Wrapper>
		</CloseHandler>
	) : null;
}
