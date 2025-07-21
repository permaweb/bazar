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
`;

export const TokenName = styled.span`
	font-size: 14px;
	font-weight: 500;
	color: var(--text-primary);
`;

export const TokenSymbol = styled.span`
	font-size: 12px;
	color: var(--text-secondary);
`;

export const HealthWrapper = styled.div`
	margin-left: auto;
	display: flex;
	align-items: center;
`;
