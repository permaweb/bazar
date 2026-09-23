import React from 'react';

import type { Collection } from 'api/collections';
import { type CollectionMintEstimate, loadMintedCollections, loadMintRuntime } from 'api/mint';

import { type AppError, toAppError } from 'helpers/app-error';
import { asyncData, isAsyncPending } from 'helpers/async-state';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';
import { useOperationActivity } from 'providers/OperationActivityProvider';
import { useWallet } from 'providers/WalletProvider';

import { COLLECTION_MESSAGES } from '../messages';
import {
	appendedCollectionAssetIds,
	collectionAppendReducer,
	collectionAppendSource,
	INITIAL_COLLECTION_APPEND,
} from '../model/collection-append';
import { collectionAppendPhaseLabel } from '../model/collection-market';

export type CollectionAppendPreview = { file: File; url: string };

export type CollectionAppendView = {
	/** The connected wallet minted this image collection and may add assets to it. */
	canAppend: boolean;
	open: boolean;
	fileCount: number;
	previews: CollectionAppendPreview[];
	estimate: CollectionMintEstimate | undefined;
	estimating: boolean;
	submitting: boolean;
	progress: string;
	error: AppError | null;
	openDialog(): void;
	close(): void;
	selectFiles(files: FileList | null): void;
	submit(): void;
};

export function useCollectionAppend(collectionId: string, collection: Collection | undefined): CollectionAppendView {
	const language = useMessages(COLLECTION_MESSAGES);
	const errorMessage = useAppErrorMessage();
	const market = useMarketProvider();
	const wallet = useWallet();
	const operations = useOperationActivity();
	const [state, dispatch] = React.useReducer(collectionAppendReducer, INITIAL_COLLECTION_APPEND);
	// Minted collections live in browser storage; read them again whenever the catalogue's assets change.
	const ownedCollection = React.useMemo(
		() => loadMintedCollections().find((item) => item.id === collectionId),
		[collectionId, collection?.assets]
	);
	const previews = React.useMemo(
		() => state.files.map((file) => ({ file, url: URL.createObjectURL(file) })),
		[state.files]
	);
	const submitting = state.submission.status === 'submitting';

	React.useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

	React.useEffect(() => {
		if (!state.open || !state.files.length || !ownedCollection) {
			dispatch({ type: 'estimate-cleared' });
			return;
		}
		const controller = new AbortController();
		const files = state.files;
		dispatch({ type: 'estimate-started' });
		void loadMintRuntime()
			.then(({ CollectionMintClient }) =>
				new CollectionMintClient().estimateAppend(ownedCollection, files, controller.signal)
			)
			.then(
				(estimate) => {
					if (!controller.signal.aborted) dispatch({ type: 'estimate-loaded', estimate });
				},
				(cause) => {
					if (!controller.signal.aborted) {
						dispatch({ type: 'estimate-failed', error: toAppError(cause, 'unknown') });
					}
				}
			);
		return () => controller.abort();
	}, [state.files, state.open, ownedCollection]);

	const submit = async () => {
		if (!collection || !ownedCollection || !wallet.address || !state.files.length || submitting) return;
		const owner = wallet.address;
		const files = state.files;
		const uploadId = `upload:${owner}:${Date.now()}`;
		dispatch({ type: 'submit-started' });
		operations.beginUpload({
			id: uploadId,
			owner,
			kind: 'collection',
			name: formatMessage(language.appendUploadName, { name: collection.name }),
			status: language.appendUploadStatus,
		});
		try {
			const { CollectionMintClient } = await loadMintRuntime();
			const result = await new CollectionMintClient().append(
				collectionAppendSource(ownedCollection, collection),
				files,
				owner,
				{
					allowHighCost: true,
					onTransaction: (transaction) => operations.recordUploadTransaction(uploadId, transaction),
					onPhase: (phase) => {
						const progress = collectionAppendPhaseLabel(phase, language);
						dispatch({ type: 'submit-progressed', progress });
						operations.updateUpload(uploadId, progress);
					},
				}
			);
			const addedIds = appendedCollectionAssetIds(collection, result.collection);
			market.addCollection(result.collection);
			operations.finishUpload(uploadId, {
				collectionId: collection.id,
				assetIds: addedIds,
				transactionIds: [result.manifestId, result.updateId],
				extended: true,
			});
			dispatch({ type: 'submit-succeeded' });
		} catch (cause) {
			const error = toAppError(cause, 'unknown');
			dispatch({ type: 'submit-failed', error });
			operations.failUpload(uploadId, errorMessage(error));
		}
	};

	return {
		canAppend: collection?.kind === 'images' && ownedCollection?.owner === wallet.address,
		open: state.open && Boolean(ownedCollection),
		fileCount: state.files.length,
		previews,
		estimate: asyncData(state.estimate),
		estimating: isAsyncPending(state.estimate),
		submitting,
		progress: state.submission.status === 'submitting' ? state.submission.progress : '',
		error: state.error,
		openDialog: () => dispatch({ type: 'opened' }),
		close: () => dispatch({ type: 'closed' }),
		selectFiles: (files) => dispatch({ type: 'files-selected', files: Array.from(files ?? []) }),
		submit: () => void submit(),
	};
}
