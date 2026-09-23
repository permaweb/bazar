// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ProfileEditSaveHandler, useProfileEditForm } from 'features/Profile/hooks/useProfileEditForm';
import { appError } from 'helpers/app-error';

import { renderHook } from '../../../test-utils/render-hook';

type Props = { open: boolean; displayName?: string; avatar?: string; onSave: ProfileEditSaveHandler };

const image = new File([new Uint8Array(4)], 'avatar.png', { type: 'image/png' });

beforeEach(() => {
	URL.createObjectURL = vi.fn(() => 'blob:avatar');
	URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	document.body.innerHTML = '';
});

function render(props: Props) {
	return renderHook(
		(current: Props) =>
			useProfileEditForm(
				current.open,
				{ displayName: current.displayName, avatar: current.avatar },
				current.onSave
			),
		props
	);
}

describe('useProfileEditForm', () => {
	it('loads the current profile whenever the editor opens', () => {
		const onSave = vi.fn();
		const hook = render({ open: false, displayName: 'Alice', avatar: 'https://example.com/a.png', onSave });
		expect(hook.current().form.displayName).toBe('');

		hook.rerender({ open: true, displayName: 'Alice', avatar: 'https://example.com/a.png', onSave });
		expect(hook.current().form.displayName).toBe('Alice');
		expect(hook.current().avatarPreview).toBe('https://example.com/a.png');
		expect(hook.current().displayNameChanged).toBe(false);

		React.act(() => hook.current().setDisplayName('Bob'));
		expect(hook.current().displayNameChanged).toBe(true);
		hook.unmount();
	});

	it('previews a selected picture and revokes its URL when replaced', () => {
		const hook = render({ open: true, displayName: 'Alice', onSave: vi.fn() });
		React.act(() => hook.current().selectAvatar(image));
		expect(hook.current().avatarPreview).toBe('blob:avatar');
		expect(hook.current().pictureChanged).toBe(true);

		React.act(() => hook.current().removeAvatar());
		expect(hook.current().avatarPreview).toBe('');
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar');
		hook.unmount();
	});

	it('locks the form with wallet status while saving and explains a failure', async () => {
		let reportStatus: (status: string) => void = () => undefined;
		let fail: (cause: unknown) => void = () => undefined;
		const onSave = vi.fn<ProfileEditSaveHandler>(
			(_update, onStatus) =>
				new Promise<void>((_resolve, reject) => {
					reportStatus = onStatus;
					fail = reject;
				})
		);
		const hook = render({ open: true, displayName: 'Alice', onSave });
		React.act(() => hook.current().setDisplayName('Bob'));

		let submitted: Promise<void> = Promise.resolve();
		React.act(() => {
			submitted = hook.current().submit();
		});
		expect(onSave).toHaveBeenCalledWith(
			{ displayName: 'Bob', displayNameChanged: true, avatarFile: null, removeAvatar: false },
			expect.any(Function)
		);
		expect(hook.current()).toMatchObject({ busy: true, status: 'Preparing profile…', error: '' });

		React.act(() => reportStatus('Approve profile…'));
		expect(hook.current().status).toBe('Approve profile…');

		fail(appError('profile-wallet-account-changed'));
		await React.act(() => submitted);
		expect(hook.current()).toMatchObject({
			busy: false,
			status: '',
			error: 'The connected wallet changed. Return to your current wallet profile and try again.',
		});
		expect(hook.current().form.displayName).toBe('Bob');
		hook.unmount();
	});
});
