import styled from 'styled-components';

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	gap: 24px;
	margin-top: 20px;
`;

export const AntCard = styled.div`
	background: var(--background-secondary);
	border-radius: 10px;
	padding: 20px;
	min-width: 220px;
	max-width: 320px;
	flex: 1 1 220px;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 10px;
`;

export const AntName = styled.div`
	font-size: 18px;
	font-weight: 600;
	color: var(--text-primary);
`;

export const AntTicker = styled.div`
	font-size: 14px;
	color: var(--text-secondary);
`;

export const AntDescription = styled.div`
	font-size: 13px;
	color: var(--text-secondary);
`;
