import styled from 'styled-components';

import { STYLING } from 'helpers/config';

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
	color: ${(props) => props.theme.colors.font.primary};
	line-height: 1.2;
`;

export const TokenSymbol = styled.span`
	font-size: 12px;
	color: ${(props) => props.theme.colors.font.alt1};
	font-weight: 500;
	line-height: 1.2;
`;

export const TokenBalance = styled.span`
	font-size: 13px;
	color: ${(props) => props.theme.colors.font.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	font-family: ${(props) => props.theme.typography.family.alt1};
	line-height: 1.2;
	opacity: 0.9;
`;

export const BalanceAndHealth = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 4px;
	margin-left: auto;
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
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 8px;
	background: ${(props) => props.theme.colors.container.primary.background};
	color: ${(props) => props.theme.colors.font.primary};
	font-size: 14px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: space-between;
	transition: all 100ms;
	position: relative;

	&:hover {
		border-color: var(--accent-primary);
		background: ${(props) => props.theme.colors.container.alt1.background};
	}

	&.active {
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px var(--accent-primary-alpha);
		background: ${(props) => props.theme.colors.container.alt1.background};
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
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0 0 0 5px;

	&.open {
		transform: rotate(180deg);
	}
`;

export const DropdownOptions = styled.div`
	position: absolute;
	top: calc(100% + 5px);
	left: 0;
	right: 0;
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt2} !important;
	border-radius: ${STYLING.dimensions.radius.primary} !important;
	z-index: 2;
	max-height: 300px;
	overflow-y: auto;
`;

export const DropdownBackdrop = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: ${(props) => props.theme.colors.overlay.alt3};
	z-index: 999;
`;

export const DropdownOption = styled.div<{ active: boolean }>`
	padding: 12px 16px;
	cursor: pointer;
	transition: all 100ms;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	background: ${(props) =>
		props.active
			? props.theme.colors.container.alt1.background
			: props.theme.colors.container.primary.background} !important;
	color: ${(props) => props.theme.colors.font.primary} !important;

	&:hover {
		background: ${(props) => props.theme.colors.container.alt1.background} !important;
		color: ${(props) => props.theme.colors.font.primary} !important;
	}

	&:last-child {
		border-radius: 0 0 6px 6px;
		border-bottom: none;
	}

	* {
		color: inherit !important;
	}

	&.selected * {
		color: ${(props) => props.theme.colors.font.primary} !important;
	}

	&.selected .TokenName,
	&.selected .TokenSymbol,
	&.selected .TokenBalance {
		color: ${(props) => props.theme.colors.font.primary} !important;
	}
`;
