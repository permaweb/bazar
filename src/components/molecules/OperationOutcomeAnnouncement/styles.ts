import styled from 'styled-components';

export const StatusHeading = styled.h3`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 10px;

	.result-outcome & {
		flex-direction: row;
		align-items: center;
		margin: 0;
	}

	.result-status-icon {
		width: 34px;
		height: 34px;
		stroke-width: 1.6;
	}
`;

export const Alert = styled.div`
	margin: 0;
	display: grid;
	gap: 8px;

	h3,
	p {
		margin: 0;
	}
`;

export const StatusRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
`;

export const StatusMeta = styled.span`
	color: var(--muted);
	font-size: var(--type-body);
	font-weight: 500;
	white-space: nowrap;
`;

export const ExternalLink = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 4px;

	.ui-icon {
		width: 15px;
		height: 15px;
	}
`;

export const Subject = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 14px;
`;

export const SubjectMedia = styled.div`
	width: 72px;
	height: 72px;
	flex: 0 0 72px;
`;

export const SubjectCopy = styled.div`
	min-width: 0;
	display: grid;
	gap: 3px;

	> span,
	> small {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> strong {
		overflow-wrap: anywhere;
		color: var(--ink);
		font-size: 1.05rem;
		font-weight: 500;
	}
`;
