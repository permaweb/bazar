import styled from 'styled-components';

// The notice itself keeps the shared `.collection-source-notice` and `.retry-notice` presentation; only the
// narrow-viewport layout of the index notice belongs to this component.
export const Notice = styled.div`
	@media (max-width: 760px) {
		&.collection-source-notice {
			align-items: center;
			flex-direction: row;
			gap: 10px;
			padding: 10px 12px;
		}

		> span {
			min-width: 0;
			line-height: 1.45;
		}

		> button {
			min-width: 72px;
			padding-inline: 10px;
		}
	}
`;

// The long wording, swapped for the short one once the notice has to share a row with its retry control.
export const FullText = styled.span`
	@media (max-width: 760px) {
		display: none;
	}
`;

export const CompactText = styled.span`
	display: none;

	@media (max-width: 760px) {
		display: inline;
	}
`;
