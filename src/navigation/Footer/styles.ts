import styled from 'styled-components';

export const Wrapper = styled.footer`
	width: calc(100% - (2 * var(--page-gutter)));
	max-width: calc(var(--max-view-width) - (2 * var(--page-gutter)));
	margin-inline: auto;
	border-top: 1px solid var(--line);
`;

export const Content = styled.div`
	min-height: 60px;
	padding-inline: 0;
	padding-block: 18px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	color: var(--muted-subtle);
	font-size: var(--type-body);

	@media (max-width: 760px) {
		align-items: flex-start;
		gap: 16px;
		flex-direction: column;
	}
`;
