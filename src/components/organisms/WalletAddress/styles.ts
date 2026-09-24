import styled from 'styled-components';

/**
 * Only the plain identity label moves here for now. The `.wallet-address` rules stay in
 * apps/bazar/styles.css until `.ui-button` and the feature rules that override them by file order
 * (`.operation-summary-link`, `.asset-owner-line .wallet-address`, `.fungible-orderbook .wallet-address`, …)
 * own their own styles; moving them alone would flip those same-weight ties.
 */
export const Identity = styled.span`
	min-width: 0;
	color: var(--ink);
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: var(--type-small);
	line-height: 1.45;
	overflow-wrap: anywhere;
	user-select: text;
`;
