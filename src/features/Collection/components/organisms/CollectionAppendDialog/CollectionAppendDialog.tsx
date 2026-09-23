import { LoaderCircle, Upload, X } from 'lucide-react';

import type { CollectionMintEstimate } from 'api/mint';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { IconButton } from 'components/atoms/IconButton';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { Dialog } from 'components/organisms/Dialog';
import { type AppError, appErrorMessage } from 'helpers/app-error';
import { winstonToAr } from 'helpers/ar-units';

// Choose images to add to a wallet-minted collection, review the storage estimate, and start the signed upload.
export default function CollectionAppendDialog(props: {
	collectionName: string;
	open: boolean;
	fileCount: number;
	previews: Array<{ file: File; url: string }>;
	estimate: CollectionMintEstimate | undefined;
	estimating: boolean;
	submitting: boolean;
	progress: string;
	error: AppError | null;
	restoreTarget(): HTMLElement | null;
	onClose(): void;
	onSelectFiles(files: FileList | null): void;
	onSubmit(): void;
}) {
	return (
		<Dialog
			as="section"
			backdropClassName="dialog-backdrop"
			className="dialog dialog-compact collection-append-dialog"
			labelledBy="append-collection-title"
			onDismiss={props.onClose}
			open={props.open}
			restoreTarget={props.restoreTarget}
		>
			<DialogHeading
				control={
					<IconButton
						icon={X}
						label="Close add assets"
						onClick={() => props.onClose()}
						disabled={props.submitting}
					/>
				}
				eyebrow="Extend collection"
				title={`Add assets to ${props.collectionName}`}
				titleId="append-collection-title"
			/>
			<p className="append-collection-copy">
				Each image becomes a wallet-owned Arweave asset. A new immutable manifest then updates the collection
				carrier.
			</p>
			<label className={`mint-dropzone${props.fileCount ? ' has-file' : ''}`}>
				<FileInput
					accept="image/png,image/jpeg,image/webp,image/gif"
					disabled={props.submitting}
					multiple
					onChange={(event) => props.onSelectFiles(event.target.files)}
				/>
				<span>
					<Upload aria-hidden="true" />
					<strong>{props.fileCount ? `${props.fileCount} images ready` : 'Choose images'}</strong>
					<small>PNG, JPEG, WebP, or GIF · up to 10 files</small>
				</span>
			</label>
			{props.fileCount ? (
				<div className="collection-append-preview" aria-label="Selected images">
					{props.previews.map((preview) => (
						<figure key={`${preview.file.name}:${preview.file.size}`}>
							<img alt="" src={preview.url} />
							<figcaption>{preview.file.name.replace(/\.[^.]+$/, '')}</figcaption>
						</figure>
					))}
				</div>
			) : null}
			<div className="collection-append-summary">
				<span>{props.estimating ? 'Checking Arweave storage cost…' : props.progress || 'Ready'}</span>
				<strong>
					{props.estimate ? (
						<ArCurrencyText>{`${winstonToAr(props.estimate.total.toString())} AR · ${
							props.estimate.transactionCount
						} transactions`}</ArCurrencyText>
					) : (
						'—'
					)}
				</strong>
			</div>
			{props.error ? <ErrorPanel message={appErrorMessage(props.error)} /> : null}
			<Button
				className="wide"
				disabled={!props.fileCount || !props.estimate || props.submitting}
				onClick={() => props.onSubmit()}
				type="button"
			>
				{props.submitting ? (
					<LoaderCircle className="spin" aria-hidden="true" />
				) : (
					<Upload aria-hidden="true" />
				)}
				{props.submitting ? 'Adding assets…' : `Add ${props.fileCount || ''} assets`}
			</Button>
		</Dialog>
	);
}
