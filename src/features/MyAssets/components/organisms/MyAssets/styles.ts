import styled from 'styled-components';

// The page title block; the route shell itself still comes from `.my-assets-page` in apps/bazar/styles.css,
// which that rule shares with the collection and asset routes.
export const Heading = styled.div`
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: var(--space-6);
	margin-bottom: var(--space-5);

	h1 {
		margin: 0;
		font-size: var(--type-page-title);
		line-height: 1;
		letter-spacing: -0.025em;
	}

	p:not(.eyebrow) {
		max-width: 720px;
		color: var(--muted-subtle);
		line-height: 1.55;
	}

	@media (max-width: 760px) {
		align-items: start;
		flex-direction: column;
	}
`;

// How many discovery candidates could not be read, with the control that retries just those.
export const HeadingStatus = styled.div`
	min-width: 0;
	max-width: 720px;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	flex-wrap: wrap;
	gap: 10px 14px;
	color: var(--negative);
	font-size: var(--type-small);
	line-height: 1.45;
	text-align: right;

	&.retry-notice {
		padding: var(--space-3) var(--space-4);
		border-radius: 10px;
	}

	> span {
		flex: 1 1 420px;
	}

	> button {
		flex: none;
	}

	@media (max-width: 760px) {
		width: 100%;
		max-width: none;
		justify-content: flex-start;
		text-align: left;
	}
`;

export const GatewayPill = styled.span`
	width: fit-content;
	max-width: 100%;
	min-width: 0;
	margin-top: 10px;
	padding: 5px 8px;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	border: 1px solid var(--line);
	border-radius: 999px;
	color: var(--muted-subtle);
	background: var(--panel);
	font-size: var(--type-small);
	font-weight: 400;
`;

export const GatewayHost = styled.span`
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

// Progress of the wallet discovery pass, above the asset groups.
export const ResolutionStatus = styled.div`
	margin: 0 0 30px;

	> div:first-child {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 6px 16px;
	}

	p {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.45;
	}

	@media (max-width: 600px) {
		margin-bottom: 24px;
	}
`;
