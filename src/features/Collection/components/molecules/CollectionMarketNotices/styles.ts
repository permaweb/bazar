import styled, { keyframes } from 'styled-components';

const resolutionScan = keyframes`
	from {
		transform: translateX(-110%);
	}
	to {
		transform: translateX(360%);
	}
`;

// The progress bar of the live-listing pass.
export const Track = styled.div`
	height: 5px;
	margin-top: 14px;
	overflow: hidden;
	border-radius: 999px;
	background: var(--surface);

	span {
		display: block;
		height: 100%;
		min-width: 2px;
		border-radius: inherit;
		background: var(--positive);
		transition: width 0.22s ease;
	}

	&.indeterminate span {
		width: 28%;
		animation: ${resolutionScan} 1.35s ease-in-out infinite;
	}
`;

// The panel around that progress bar, with the pass's headline and its progress text.
export const Status = styled.div`
	margin: -8px 0 24px;
	padding: 13px 15px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);

	> div:first-child {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		color: var(--muted-subtle);
		font-size: var(--type-body);

		@media (max-width: 760px) {
			align-items: start;
			flex-direction: column;
			gap: 5px;
		}
	}

	strong {
		color: var(--ink);
		font-family: 'DM Sans', sans-serif;
	}

	.resolution-track {
		margin-top: 10px;
	}
`;
