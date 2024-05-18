import React from 'react';
import { useSelector } from 'react-redux';

import { ASSETS } from 'helpers/config';
import { RootState } from 'store';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';
import { IProps } from './types';

export default function Streaks(props: IProps) {
	const streaksReducer = useSelector((state: RootState) => state.streaksReducer);

	const [showDropdown, setShowDropdown] = React.useState<boolean>(false);

	function getRangeLabel(number: number) {
		if (number >= 0 && number <= 7) return '0-7';
		if (number >= 8 && number <= 14) return '8-14';
		if (number >= 15 && number <= 29) return '15-29';
		if (number >= 30) return '30+';
		return 'out-of-range';
	}

	function getStreakIcon(count: number) {
		if (count !== null) {
			let icon: string;
			switch (getRangeLabel(count)) {
				case '0-7':
					icon = ASSETS.streak1;
					break;
				case '8-14':
					icon = ASSETS.streak2;
					break;
				case '15-29':
					icon = ASSETS.streak3;
					break;
				case '30+':
					icon = ASSETS.streak4;
					break;
				default:
					break;
			}
			return <img src={icon} />;
		} else return null;
	}

	const handleShowDropdown = React.useCallback(() => {
		setShowDropdown((prev) => !prev);
	}, []);

	const label = React.useMemo(() => {
		let count = 0;
		if (streaksReducer && props.address && streaksReducer[props.address]) {
			count = streaksReducer[props.address].days;
		}
		return (
			<>
				{getStreakIcon(count)}
				<span>{count}</span>
			</>
		);
	}, [props.address, streaksReducer]);

	return props.address ? (
		<CloseHandler active={showDropdown} disabled={!showDropdown} callback={handleShowDropdown}>
			<S.Wrapper>
				<S.Action onClick={handleShowDropdown} className={'border-wrapper-alt2'}>
					{label}
				</S.Action>
				{showDropdown && <S.Dropdown className={'fade-in border-wrapper-alt3'}></S.Dropdown>}
			</S.Wrapper>
		</CloseHandler>
	) : null;
}
