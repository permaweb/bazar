import { LoaderCircle, Upload, X } from 'lucide-react';

import type { CollectionMintEstimate } from 'api/mint';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { IconButton } from 'components/atoms/IconButton';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { Dialog } from 'components/organisms/Dialog';
import type { AppError } from 'helpers/app-error';
import { winstonToAr } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';

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
	const language = useMessages(COLLECTION_MESSAGES);
	const errorMessage = useAppErrorMessage();
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
						label={language.appendClose}
						onClick={() => props.onClose()}
						disabled={props.submitting}
					/>
				}
				eyebrow={language.appendEyebrow}
				title={formatMessage(language.appendTitle, { name: props.collectionName })}
				titleId="append-collection-title"
			/>
			<p className="append-collection-copy">{language.appendIntro}</p>
			<label className={`mint-dropzone${props.fileCount ? ' has-file' : ''}`}>
				<FileInput
					accept="image/png,image/jpeg,image/webp,image/gif"
					disabled={props.submitting}
					multiple
					onChange={(event) => props.onSelectFiles(event.target.files)}
				/>
				<span>
					<Upload aria-hidden="true" />
					<strong>
						{props.fileCount
							? formatMessage(language.appendFilesReady, { count: props.fileCount })
							: language.appendChooseImages}
					</strong>
					<small>{language.appendFileHint}</small>
				</span>
			</label>
			{props.fileCount ? (
				<div className="collection-append-preview" aria-label={language.appendSelectedImages}>
					{props.previews.map((preview) => (
						<figure key={`${preview.file.name}:${preview.file.size}`}>
							<img alt="" src={preview.url} />
							<figcaption>{preview.file.name.replace(/\.[^.]+$/, '')}</figcaption>
						</figure>
					))}
				</div>
			) : null}
			<div className="collection-append-summary">
				<span>{props.estimating ? language.appendEstimating : props.progress || language.appendReady}</span>
				<strong>
					{props.estimate ? (
						<ArCurrencyText>
							{formatMessage(language.appendEstimateValue, {
								amount: winstonToAr(props.estimate.total.toString()),
								transactions: props.estimate.transactionCount,
							})}
						</ArCurrencyText>
					) : (
						'—'
					)}
				</strong>
			</div>
			{props.error ? (
				<ErrorPanel heading={language.collectionErrorHeading} message={errorMessage(props.error)} />
			) : null}
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
				{props.submitting
					? language.appendSubmitting
					: formatMessage(language.appendSubmit, { count: props.fileCount || '' })}
			</Button>
		</Dialog>
	);
}
