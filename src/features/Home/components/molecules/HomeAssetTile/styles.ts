import styled from 'styled-components';

export const Details = styled.div`
	min-width: 0;
	margin: 0;
	padding: 10px 12px;
	display: flex;
	flex: 0 0 auto;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
	color: var(--ink);
	background: var(--paper);
	transition: background 100ms ease;

	> div {
		min-width: 0;
	}

	> div > strong,
	> div > span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	> div > strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 400;
	}

	> div > span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	@media (max-width: 480px) {
		gap: 6px;
	}
`;

export const Price = styled.b`
	flex: 0 0 auto;
	color: var(--ink);
	font-size: var(--type-body);
	font-weight: 400;
	line-height: 1.35;
	white-space: nowrap;

	&.listed {
		color: var(--positive-text);
	}

	@media (max-width: 480px) {
		font-size: var(--type-small);
	}
`;
