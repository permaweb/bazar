import styled from 'styled-components';

/**
 * The toolbar above a collection's assets. `.asset-tools` and `.collection-market-tools` always sit on the same
 * element, so their rules are consolidated here in stylesheet order and only the winning declarations are kept:
 * the unconditional `.collection-market-tools` rule came last, so it also beat the 760px `align-items: stretch`
 * and the whole 480px `gap`/`margin-bottom` block, which are dropped rather than moved (a media block is emitted
 * after the block's own declarations, which would flip the result).
 */
export const Tools = styled.div`
	display: grid;
	grid-template-columns: auto minmax(180px, 1fr) auto;
	align-items: center;
	margin-bottom: 12px;
	gap: 10px;
	padding: 0;

	> input {
		max-width: 520px;
	}

	/*
	 * These keep the two-class weight they had in apps/bazar/styles.css, so they still win over the select atom's
	 * own :hover, .open and :focus-visible border colour, which stays in that stylesheet.
	 */
	.market-select {
		min-width: 138px;
	}

	.market-select:first-child {
		min-width: 174px;
	}

	.market-select-trigger {
		min-height: 38px;
		border-color: var(--line);
	}

	@media (max-width: 760px) {
		display: flex;
		flex-direction: column;

		> input {
			max-width: none;
		}
	}

	@media (max-width: 1180px) {
		grid-template-columns: auto minmax(160px, 1fr);
	}

	@media (max-width: 600px) {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);

		.market-select,
		.market-select:first-child {
			min-width: 0;
		}

		.market-select-trigger > span {
			min-width: 0;
			overflow: hidden;
			font-size: var(--type-small);
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
`;

// Sort and listing selects plus the result count, next to the search field.
export const Controls = styled.div`
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 12px;

	.asset-filters {
		flex: 0 1 320px;
	}

	> span {
		min-width: auto;
		padding: 0;
		color: var(--muted-subtle);
		font-size: var(--type-small);
		text-align: right;
		white-space: nowrap;

		@media (max-width: 600px) {
			align-self: center;
			justify-self: start;
			text-align: left;
		}
	}

	@media (max-width: 760px) {
		width: 100%;
		gap: 12px;
	}

	@media (max-width: 1180px) {
		grid-column: 1 / -1;
		justify-content: space-between;
	}

	@media (max-width: 600px) {
		width: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
`;

// The 480px block set `gap: 8px`, which the unconditional `.collection-market-tools .asset-filters` rule later
// overrode with 6px, so that declaration is dropped rather than moved.
export const Filters = styled.div`
	flex: 0 1 320px;
	display: flex;
	gap: 6px;

	@media (max-width: 760px) {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	@media (max-width: 480px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: 600px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
`;

export const ViewToggle = styled.div`
	display: flex;
	gap: 3px;

	.ui-button {
		width: 38px;
		height: 38px;
		min-height: 38px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 5px;
		color: var(--muted);
	}

	.ui-button.active {
		border-color: var(--ink);
		color: var(--ink);
		background: var(--surface-subtle);
	}

	svg {
		width: 16px;
		height: 16px;
	}
`;

export const Search = styled.label`
	position: relative;
	min-width: 0;
	display: block;

	> svg {
		position: absolute;
		z-index: 1;
		top: 50%;
		left: 12px;
		width: 16px;
		height: 16px;
		color: var(--muted-subtle);
		transform: translateY(-50%);
	}

	input {
		min-height: 38px;
		padding-left: 38px;
		border-color: var(--line);
	}
`;
