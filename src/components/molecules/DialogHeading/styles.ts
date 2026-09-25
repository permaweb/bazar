import styled from 'styled-components';

// The dialog title row. A dialog in its form phase pins the heading so only the form body scrolls.
export const Heading = styled.div`
	display: flex;
	align-items: start;
	justify-content: space-between;
	margin-bottom: var(--space-5);

	> div {
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: var(--type-display);
		overflow-wrap: anywhere;
	}

	.dialog-form-phase & {
		flex: 0 0 auto;
		margin-bottom: var(--space-5);
	}

	@media (max-height: 480px) {
		.dialog-form-phase & {
			flex: 0 0 auto;
			margin-bottom: 16px;
		}
	}
`;

export const AssetHeading = styled.div`
	display: flex;
	align-items: center;
	gap: var(--space-3);
`;

export const AssetHeadingCopy = styled.div`
	min-width: 0;

	.eyebrow {
		margin-bottom: 4px;
	}
`;
