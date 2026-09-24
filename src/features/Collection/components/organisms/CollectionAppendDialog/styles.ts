import styled from 'styled-components';

import { Dialog } from 'components/organisms/Dialog';

/**
 * The generic modal chrome stays in apps/bazar/styles.css with the dialog organism; only the collection-specific
 * rules moved here. The dropzone rules keep the two-class weight they had, so they still win over the shared
 * `.mint-dropzone` presentation the mint media picker also uses.
 */
export const Root = styled(Dialog)`
	max-width: 720px;

	.mint-dropzone {
		min-height: 132px;
		aspect-ratio: auto;
		margin: 20px 0 16px;
	}

	.mint-dropzone > span {
		padding: 22px;
	}

	.mint-dropzone input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
`;

export const Copy = styled.p`
	color: var(--muted);
	line-height: 1.55;
`;

export const Preview = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
	gap: 12px;

	figure {
		min-width: 0;
		margin: 0;
	}

	img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 10px;
		object-fit: cover;
	}

	figcaption {
		margin-top: 6px;
		overflow: hidden;
		color: var(--muted);
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const Summary = styled.div`
	display: flex;
	justify-content: space-between;
	gap: 16px;
	padding: 14px 0;
	border-top: 1px solid var(--line);
	border-bottom: 1px solid var(--line);
`;
