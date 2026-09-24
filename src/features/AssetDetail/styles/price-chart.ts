import styled from 'styled-components';

// The chart frame is shared by the real price chart (a lazy chunk) and the eager loading shell placeholder.

export const Chart = styled.section`
	overflow: hidden;
	border: 1px solid var(--line-dark);
	border-radius: 18px;
	background: var(--paper);
`;

export const Heading = styled.div`
	min-height: 128px;
	padding: 22px 22px 8px;
	display: flex;
	align-items: start;
	justify-content: flex-start;
	gap: 24px;

	@media (max-width: 760px) {
		min-height: 122px;
		padding: 20px 16px 6px;
		gap: 12px;
	}
`;
