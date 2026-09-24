import styled from 'styled-components';

// Shown when a collection's own assets are filtered down to nothing.
export const Empty = styled.div`
	max-width: 430px;
	margin: 58px auto 72px;
	display: grid;
	justify-items: center;
	text-align: center;

	> span {
		width: 38px;
		height: 38px;
		margin-bottom: 15px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		color: var(--muted-subtle);
		background: var(--surface-subtle);
	}

	h3 {
		margin: 0;
		font-size: var(--type-body);
		font-weight: 400;
	}

	p {
		margin: 7px 0 17px;
		color: var(--muted-subtle);
		font-size: var(--type-body);
		line-height: 1.5;
	}

	button {
		min-height: 36px;
		padding: 8px 13px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--button-accent);
		cursor: pointer;
		font-size: var(--type-body);
		font-weight: 400;
	}

	button:hover {
		background: var(--button-accent-hover);
	}

	@media (max-width: 480px) {
		margin: 42px auto 56px;
		padding-inline: 18px;
	}
`;
