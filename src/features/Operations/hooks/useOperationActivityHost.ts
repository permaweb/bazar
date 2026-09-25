import React from 'react';
import { useNavigate } from 'react-router-dom';

import type { MintActivity } from 'api/mint';

import { useMessages } from 'providers/LanguageProvider';
import { type OperationActivity, type UploadActivity, useOperationActivity } from 'providers/OperationActivityProvider';

import { OPERATIONS_MESSAGES } from '../messages';
import { mintUploadActivity, standaloneMintActivities, uploadRelatedMintActivities } from '../model/upload-activity';

type OperationActivityContext = ReturnType<typeof useOperationActivity>;

export type UploadPanelActivity = {
	activity: UploadActivity;
	relatedMintActivities: MintActivity[];
};

/**
 * The global operation, upload, and mint surfaces owned by the operation activity provider, with the navigation and
 * refresh events their dialogs trigger.
 */
export function useOperationActivityHost(): {
	mintNotice: MintActivity | null;
	operations: OperationActivity[];
	activeOperationId: string | null;
	uploads: UploadPanelActivity[];
	activeUploadId: string | null;
	mintUploads: UploadPanelActivity[];
	activeMintId: string | null;
	update: OperationActivityContext['update'];
	updateOperation: OperationActivityContext['updateOperation'];
	hideOperation(): void;
	hideUpload(): void;
	hideMint(): void;
	removeUpload(id: string): void;
	dismissMintNotice(): void;
	viewMintNoticeAsset(): void;
	viewOperationAsset(activity: OperationActivity): void;
	closeOperation(activity: OperationActivity, resumeLater?: boolean, refresh?: boolean): void;
} {
	const navigate = useNavigate();
	const messages = useMessages(OPERATIONS_MESSAGES);
	const operationActivity = useOperationActivity();
	const uploadActivities = operationActivity.uploadActivities;
	const mintActivities = operationActivity.mintActivities;
	const uploads = React.useMemo(
		() =>
			uploadActivities.map((activity) => ({
				activity,
				relatedMintActivities: uploadRelatedMintActivities(activity, mintActivities),
			})),
		[mintActivities, uploadActivities]
	);
	const mintUploads = React.useMemo(
		() =>
			standaloneMintActivities(mintActivities, uploadActivities).map((activity) => ({
				activity: mintUploadActivity(activity, messages),
				relatedMintActivities: [activity],
			})),
		[messages, mintActivities, uploadActivities]
	);

	function viewMintNoticeAsset() {
		const notice = operationActivity.mintNotice;
		if (!notice) return;
		navigate(`/asset/${notice.collectionId}/${notice.asset.id}`);
		operationActivity.dismissMintNotice();
	}

	function viewOperationAsset(activity: OperationActivity) {
		navigate(`/asset/${activity.collectionId}/${activity.asset.id}`);
		operationActivity.remove(activity.id);
	}

	function closeOperation(activity: OperationActivity, resumeLater?: boolean, refresh = true) {
		if (refresh) {
			window.dispatchEvent(new CustomEvent('bazar:asset-operation-finished', { detail: activity.asset.id }));
		}
		if (resumeLater) operationActivity.hideOperation();
		else operationActivity.remove(activity.id);
	}

	return {
		mintNotice: operationActivity.mintNotice,
		operations: operationActivity.activities,
		activeOperationId: operationActivity.activeId,
		uploads,
		activeUploadId: operationActivity.activeUploadId,
		mintUploads,
		activeMintId: operationActivity.activeMintId,
		update: operationActivity.update,
		updateOperation: operationActivity.updateOperation,
		hideOperation: operationActivity.hideOperation,
		hideUpload: operationActivity.hideUpload,
		hideMint: operationActivity.hideMint,
		removeUpload: operationActivity.removeUpload,
		dismissMintNotice: operationActivity.dismissMintNotice,
		viewMintNoticeAsset,
		viewOperationAsset,
		closeOperation,
	};
}
