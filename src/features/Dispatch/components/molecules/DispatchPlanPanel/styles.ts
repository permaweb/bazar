import styled from 'styled-components';

export { Notice, Success, Table, TableWrapper } from '../../../styles/create-form';

export const Plan = styled.div`
	display: flex;
	flex-direction: column;
	gap: 20px;
`;

export const PlanHeading = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 16px;

	> div:first-child {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	> div:first-child span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> div:last-child {
		display: flex;
		gap: 10px;
	}
`;

/** One recipient row; its status modifier tints the trailing cell. */
export const PlanRow = styled.tr`
	&.dispatch-row-posted td:last-child {
		color: var(--muted);
	}

	&.dispatch-row-settled td:last-child .ui-icon {
		vertical-align: -2px;
	}
`;
