import styled from 'styled-components';

export const Wrapper = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
`;

export const Label = styled.label`
	font-size: 14px;
	font-weight: 500;
	color: var(--text-primary);
`;

export const SelectWrapper = styled.div`
	position: relative;
`;

export const Select = styled.select`
	width: 100%;
	padding: 8px 12px;
	border: 1px solid var(--border-primary);
	border-radius: 8px;
	background: var(--background-primary);
	color: var(--text-primary);
	font-size: 14px;
	cursor: pointer;
	appearance: none;
	background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
	background-repeat: no-repeat;
	background-position: right 8px center;
	background-size: 16px;
	padding-right: 32px;

	&:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px var(--accent-primary-alpha);
	}
`;

export const Option = styled.option`
	padding: 8px;
`;

export const TokenOption = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 4px 0;
`;

export const TokenLogo = styled.div`
	width: 20px;
	height: 20px;
	border-radius: 50%;
	overflow: hidden;
	flex-shrink: 0;

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

export const TokenInfo = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
	flex: 1;
`;

export const TokenName = styled.span`
	font-size: 14px;
	font-weight: 600;
	color: #ffffff;
	line-height: 1.2;
`;

export const TokenSymbol = styled.span`
	font-size: 12px;
	color: #cccccc;
	font-weight: 500;
	line-height: 1.2;
`;

export const TokenBalance = styled.span`
	font-size: 11px;
	color: #999999;
	font-weight: 400;
	line-height: 1.2;
	opacity: 0.8;
`;

export const HealthWrapper = styled.div`
	display: flex;
	align-items: center;
`;

// New custom dropdown styles
export const CustomSelectWrapper = styled.div`
	position: relative;
	width: 100%;
`;

export const CustomSelect = styled.div`
	width: 100%;
	padding: 12px 16px;
	border: 1px solid var(--border-primary);
	border-radius: 8px;
	background: var(--background-primary);
	color: var(--text-primary);
	font-size: 14px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: space-between;
	transition: all 0.2s ease;
	position: relative;
	z-index: 10;

	&:hover {
		border-color: var(--accent-primary);
		background: var(--background-secondary);
	}

	&.active {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px var(--accent-primary-alpha);
		background: var(--background-secondary);
	}
`;

export const SelectedToken = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
`;

export const DropdownArrow = styled.div`
	display: flex;
	align-items: center;
	transition: transform 0.2s ease;
	color: var(--text-secondary);

	&.open {
		transform: rotate(180deg);
	}
`;

export const DropdownOptions = styled.div`
	position: absolute;
	top: 100%;
	left: 0;
	right: 0;
	background: #1a1a1a;
	border: 2px solid #333;
	border-top: none;
	border-radius: 0 0 8px 8px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
	z-index: 1000;
	max-height: 200px;
	overflow-y: auto;
	margin-top: -1px;
`;

export const DropdownBackdrop = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.1);
	z-index: 999;
`;

export const DropdownOption = styled.div`
	padding: 12px 16px;
	cursor: pointer;
	transition: background-color 0.2s ease;
	border-bottom: 1px solid #333;
	background: #1a1a1a;

	&:hover {
		background: #2a2a2a;
	}

	&.selected {
		background: #3a3a3a;
		border-left: 3px solid var(--accent-primary);
	}

	&:last-child {
		border-radius: 0 0 6px 6px;
		border-bottom: none;
	}
`;
