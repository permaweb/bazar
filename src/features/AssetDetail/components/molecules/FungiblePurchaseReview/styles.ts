import styled from 'styled-components';

export const Amount = styled.div`
	padding: 2px 0 18px;
	display: grid;
	gap: 4px;

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	strong {
		color: var(--ink);
		font-size: 1.45rem;
		font-weight: 500;
		letter-spacing: -0.025em;
	}
`;

export const Facts = styled.dl`
	margin: 0;
	border-top: 1px solid var(--line);

	dt {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> div {
		min-width: 0;
		padding: 12px 0;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 20px;
		border-bottom: 1px solid var(--line);
	}

	dt,
	dd {
		margin: 0;
	}

	dd {
		min-width: 0;
		color: var(--ink);
		font-size: var(--type-body);
		text-align: right;
		overflow-wrap: anywhere;
	}
`;

export const Total = styled.div`
	dt,
	dd {
		color: var(--ink);
		font-weight: 600;
	}
`;

export const Meta = styled.p`
	margin: 0;
	padding: 13px 0 2px;
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1.45;
`;

export const FormError = styled.p`
	margin: -10px 0 0;
	color: var(--negative);
	font-size: var(--type-small);
	line-height: 1.5;
`;
