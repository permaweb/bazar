import styled from 'styled-components';

export const Panel = styled.div`
	margin: 30px 0;
	padding: clamp(30px, 5vw, 58px);
	border: 1px solid var(--line);
	border-radius: 10px;
	background: var(--paper);
	text-align: center;

	h3 {
		margin: 0 0 8px;
		font-size: var(--type-display);
	}

	p {
		max-width: 590px;
		margin: 0 auto 20px;
		color: var(--muted-subtle);
		line-height: 1.55;
	}
`;
