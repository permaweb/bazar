import styled from 'styled-components';

// Shared by FungiblePurchaseComposer and FungibleListingComposer, which render the same two-panel composer.

export const Composer = styled.section`
	position: relative;
	margin-top: 0;
	min-width: 0;
	display: grid;
`;

export const Panel = styled.div`
	min-width: 0;
	padding: 15px 16px;
	display: grid;
	gap: 8px;
	border: 1px solid var(--line-dark);
	background: var(--paper);

	small {
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.35;
	}
`;

export const BuyPanel = styled(Panel)`
	padding-bottom: 26px;
	border-radius: 10px 10px 0 0;
`;

export const PayPanel = styled(Panel)`
	position: relative;
	padding-top: 27px;
	border-top: 0;
	border-radius: 0 0 10px 10px;
	background: var(--panel);
`;

export const Heading = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	color: var(--muted);
	font-size: var(--type-small);

	button {
		min-height: 26px;
		padding: 3px 8px;
		border-color: var(--line);
		border-radius: 5px;
		background: var(--panel);
		color: var(--ink);
		font-size: var(--type-small);
	}
`;

export const Value = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	input,
	strong {
		min-width: 0;
		width: 100%;
		padding: 0;
		border: 0;
		background: var(--transparent);
		color: var(--ink);
		font-size: clamp(1.8rem, 4vw, 2.45rem);
		font-weight: 450;
		letter-spacing: -0.04em;
		line-height: 1.05;
		font-variant-numeric: tabular-nums;
	}

	input:focus {
		outline: 0;
		box-shadow: none;
	}

	input::placeholder {
		color: var(--muted-subtle);
	}
`;

export const Token = styled.span`
	flex: 0 0 auto;
	min-height: 34px;
	padding: 7px 10px;
	display: inline-flex;
	align-items: center;
	border: 1px solid var(--line);
	border-radius: 999px;
	background: var(--paper);
	color: var(--ink);
	font-size: var(--type-body);
	font-weight: 650;
	letter-spacing: 0.015em;
`;

export const Direction = styled.span`
	position: absolute;
	top: 0;
	left: 50%;
	z-index: 2;
	width: 38px;
	height: 38px;
	transform: translate(-50%, -50%);
	display: grid;
	place-items: center;
	border: 4px solid var(--paper);
	border-radius: 10px;
	background: var(--panel);
	color: var(--ink);

	svg {
		width: 18px;
		height: 18px;
		stroke-width: 1.8;
	}
`;

export const ComposerError = styled.p`
	margin: 8px 2px 0;
	color: var(--negative);
	font-size: var(--type-small);
	line-height: 1.4;

	& + & {
		margin-top: 4px;
	}
`;
