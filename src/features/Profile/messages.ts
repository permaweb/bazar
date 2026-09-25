import { defineMessages } from 'helpers/i18n';

export const PROFILE_MESSAGES = defineMessages({
	en: {
		profilePageEyebrow: 'Arweave profile',
		profilePageEditAvatarLabel: 'Edit profile picture',
		profilePageEditLabel: 'Edit profile',
		profilePageResolving: 'Resolving this profile from Arweave…',
		profilePageRetry: 'Retry',
		profileInvalidAddress: 'This is not a valid Arweave profile address.',
		profileUnreadable: 'This profile could not be read from Arweave.',
		profileEditClose: 'Close profile editor',
		profileEditEyebrow: 'Your public identity',
		profileEditTitle: 'Edit profile',
		profileEditNameLabel: 'Profile name',
		profileEditNamePlaceholder: 'How people will see you',
		profileEditPictureLabel: 'Profile picture',
		profileEditPictureChange: 'Change profile picture',
		profileEditPictureChoose: 'Choose profile picture',
		profileEditPicturePreview: 'Profile picture preview',
		profileEditPictureReplacePrompt: 'Drop or choose a new image',
		profileEditPicturePrompt: 'Drop an image here',
		profileEditPictureHint: 'PNG, JPEG, WebP, or GIF · up to 10 MB',
		profileEditRemovePicture: 'Remove picture',
		profileEditNote:
			'Your profile is saved permanently on Arweave. A new picture may require two wallet approvals.',
		profileEditCancel: 'Cancel',
		profileEditSave: 'Save profile',
		profileSaveApprovePicture: 'Approve picture…',
		profileSaveUploadingPicture: 'Uploading picture…',
		profileSaveApproveProfile: 'Approve profile…',
		profileSavePublishingProfile: 'Publishing profile…',
		profileSavePreparing: 'Preparing profile…',
		profileSavePreparingPicture: 'Preparing picture…',
	},
});

export type ProfileMessages = (typeof PROFILE_MESSAGES)['en'];
