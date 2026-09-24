import styled from 'styled-components';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';

export const PreviewColumn = styled.div`
	position: sticky;
	top: 85px;

	@media (max-width: 1050px) {
		position: static;
	}
`;

export const TokenPreview = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 20px;
	padding: 48px 30px;
	border: 1px solid var(--line-dark);
	border-radius: 10px;
	background: var(--panel);
	cursor: default;

	> span {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		text-align: center;
	}

	> span strong {
		font-size: var(--type-body);
		color: var(--ink);
	}

	> span small {
		color: var(--muted);
		word-break: break-all;
	}
`;

export const TokenPreviewMark = styled.div`
	width: 160px;
	height: 160px;
	display: grid;
	place-items: center;
	overflow: hidden;
	border: 1px solid var(--line-dark);
	border-radius: 50%;
	background: var(--panel);

	.token-artwork {
		font-size: var(--type-display);
	}

	> img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}
`;

export const TokenPreviewTicker = styled.small`
	letter-spacing: 0.04em;
`;

/**
 * The grid of collection thumbnails inside the drop zone. `.mint-dropzone` itself is still a global class because
 * the collection append dialog renders one too, so the layout rule keeps its original `.mint-dropzone > …` shape.
 */
export const CollectionPreviewGrid = styled.span`
	.mint-dropzone > & {
		position: relative;
		width: 100%;
		height: 100%;
		padding: 14px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	> span {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border-radius: 7px;
		background: var(--surface);
	}

	img {
		object-fit: cover;
	}

	small {
		position: absolute;
		right: 7px;
		bottom: 7px;
		min-width: 22px;
		height: 22px;
		padding: 0 5px;
		display: grid;
		place-items: center;
		border-radius: 5px;
		background: var(--image-control-surface);
		color: var(--fixed-ink);
		font-size: var(--type-small);
		font-weight: 400;
	}

	> strong {
		position: absolute;
		right: 26px;
		bottom: 26px;
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--preview-overlay);
		color: var(--contrast-text);
		font-size: var(--type-body);
	}
`;

export const HiddenFileInput = styled(FileInput)`
	display: none;
`;

export const FileMeta = styled.div`
	margin-top: 10px;
	display: flex;
	justify-content: space-between;
	gap: 18px;
	color: var(--muted-subtle);
	font-size: var(--type-body);

	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: var(--ink);
		font-weight: 400;
	}
`;

export const AudioMetadata = styled.div`
	margin-top: 12px;
	padding: 12px;
	display: grid;
	gap: 9px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--paper);

	> strong {
		font-size: var(--type-body);
		font-weight: 500;
	}

	dl {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px 14px;
	}

	dl > div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	dt {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	dd {
		margin: 0;
		overflow: hidden;
		font-size: var(--type-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const ArtworkField = styled.div`
	margin-top: 14px;
	padding: 12px;
	display: grid;
	gap: 12px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--paper);

	> div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	> div > span {
		min-width: 0;
		display: grid;
		gap: 3px;
	}

	small {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	img {
		width: 56px;
		height: 56px;
		flex: none;
		border: 1px solid var(--line);
		border-radius: 6px;
		object-fit: cover;
	}

	button {
		min-height: 34px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--panel);
		color: var(--ink);
		cursor: pointer;
	}
`;

export const CollectionFileList = styled.div`
	margin-top: 12px;
	display: grid;
	gap: 1px;
	border: 1px solid var(--line);
	border-radius: 8px;
	overflow: hidden;
	background: var(--line);

	> div {
		min-height: 40px;
		padding: 0 9px 0 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		background: var(--paper);
	}

	> div > span {
		min-width: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		gap: 9px;
		color: var(--muted-subtle);
		font-size: var(--type-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	> div > span strong {
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		border-radius: 5px;
		background: var(--surface);
		color: var(--ink);
		font-size: var(--type-small);
	}

	button {
		min-height: 34px;
		border: 0;
		background: var(--transparent);
		cursor: pointer;
	}

	> div button {
		width: 32px;
		padding: 0;
		display: grid;
		place-items: center;
		color: var(--muted-subtle);
	}

	> button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		background: var(--panel);
		font-size: var(--type-body);
		font-weight: 400;
	}
`;
