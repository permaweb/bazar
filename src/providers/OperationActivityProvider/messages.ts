import { defineMessages } from 'helpers/i18n';

export const OPERATION_ACTIVITY_MESSAGES = defineMessages({
	en: {
		// Atomic operation activity, from the moment the provider opens one.
		operationStatusApproval: 'Waiting for wallet approval',
		operationStatusWorking: 'Starting transaction…',
		operationStatusForm: 'Waiting for details',

		// Upload activity, once Arweave accepted the submission.
		uploadStatusLive: 'Live on Bazar.',
		uploadStatusAssetSubmitted: 'Submitted; accepted by Arweave. Waiting for live process state.',
		uploadStatusCollectionUpdateSubmitted: 'Collection manifest update submitted to Arweave.',
		uploadStatusCollectionSubmitted: 'Collection process submitted to Arweave.',

		// System notification for a mint that reached live process state.
		mintLiveNotificationTitle: '{name} is live on Bazar',
		mintLiveNotificationBody: 'The accepted Arweave upload is now available in live process state.',
	},
});

export type OperationActivityMessages = (typeof OPERATION_ACTIVITY_MESSAGES)['en'];
