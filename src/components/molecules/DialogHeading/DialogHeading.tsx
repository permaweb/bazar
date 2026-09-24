import React from 'react';

import { Eyebrow } from '../../atoms/Eyebrow';

import * as S from './styles';

// Title row shared by marketplace dialogs: optional artwork, eyebrow, title, and a trailing control.
// `layout="asset"` renders the artwork-and-copy structure used by transaction dialogs.
export default function DialogHeading(props: {
	title: React.ReactNode;
	titleId: string;
	eyebrow?: React.ReactNode;
	eyebrowId?: string;
	artwork?: React.ReactNode;
	layout?: 'plain' | 'asset';
	control: React.ReactNode;
}) {
	const copy = (
		<>
			{props.eyebrow ? <Eyebrow id={props.eyebrowId}>{props.eyebrow}</Eyebrow> : null}
			<h2 id={props.titleId}>{props.title}</h2>
		</>
	);
	const assetCopy = <S.AssetHeadingCopy className="dialog-asset-heading-copy">{copy}</S.AssetHeadingCopy>;
	return (
		<div className="dialog-heading">
			{props.layout === 'asset' ? (
				props.artwork ? (
					<S.AssetHeading className="dialog-asset-heading">
						{props.artwork}
						{assetCopy}
					</S.AssetHeading>
				) : (
					<div>{assetCopy}</div>
				)
			) : (
				<div>{copy}</div>
			)}
			{props.control}
		</div>
	);
}
