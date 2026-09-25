// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountProfile } from 'api/profile';

import { useAccountProfile } from 'features/Profile/hooks/useAccountProfile';

import { flushPromises, renderHook } from '../../../test-utils/render-hook';

const api = vi.hoisted(() => ({
	readAccountProfile: vi.fn(),
	uploadAvatar: vi.fn(),
	update: vi.fn(),
}));

vi.mock('api/profile', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/profile')>();
	return {
		...actual,
		readAccountProfile: api.readAccountProfile,
		ProfileClient: class {
			uploadAvatar = api.uploadAvatar;
			update = api.update;
		},
	};
});

const ALICE = 'A'.repeat(43);
const BOB = 'B'.repeat(43);

function record(address: string, handle: string): AccountProfile {
	return { address, transactionId: 'T'.repeat(43), handle, name: '', bio: '', avatar: '' };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (cause: unknown) => void;
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

beforeEach(() => {
	api.readAccountProfile.mockReset();
	api.uploadAvatar.mockReset();
	api.update.mockReset();
});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('useAccountProfile', () => {
	it('does not read an invalid address', () => {
		const hook = renderHook((address: string) => useAccountProfile(address), 'not-an-address');
		expect(hook.current().profile).toEqual({ status: 'idle' });
		expect(api.readAccountProfile).not.toHaveBeenCalled();
		hook.unmount();
	});

	it('loads the profile and summarizes it', async () => {
		api.readAccountProfile.mockResolvedValue(record(ALICE, 'alice'));
		const hook = renderHook((address: string) => useAccountProfile(address), ALICE);
		expect(hook.current().profile.status).toBe('loading');
		await flushPromises();
		expect(hook.current().profile).toEqual({ status: 'success', data: record(ALICE, 'alice') });
		expect(hook.current().summary).toEqual({ address: ALICE, displayName: 'alice' });
		hook.unmount();
	});

	it('lets the latest address win and aborts the superseded read', async () => {
		const first = deferred<AccountProfile>();
		const second = deferred<AccountProfile>();
		api.readAccountProfile.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const hook = renderHook((address: string) => useAccountProfile(address), ALICE);
		const firstSignal: AbortSignal = api.readAccountProfile.mock.calls[0][1].signal;

		hook.rerender(BOB);
		expect(firstSignal.aborted).toBe(true);
		second.resolve(record(BOB, 'bob'));
		first.resolve(record(ALICE, 'alice'));
		await flushPromises();
		expect(hook.current().summary.displayName).toBe('bob');
		hook.unmount();
	});

	it('reports a failed read and retries from a clean loading state', async () => {
		api.readAccountProfile.mockRejectedValueOnce(new Error('gateway down'));
		api.readAccountProfile.mockResolvedValueOnce(null);
		const hook = renderHook((address: string) => useAccountProfile(address), ALICE);
		await flushPromises();
		const failed = hook.current().profile;
		expect(failed.status).toBe('error');
		expect(failed.status === 'error' ? failed.error.code : null).toBe('unavailable');

		React.act(() => hook.current().retry());
		await flushPromises();
		expect(hook.current().profile).toEqual({ status: 'success', data: null });
		expect(api.readAccountProfile).toHaveBeenCalledTimes(2);
		hook.unmount();
	});

	it('aborts the read on unmount', () => {
		api.readAccountProfile.mockReturnValue(new Promise(() => undefined));
		const hook = renderHook((address: string) => useAccountProfile(address), ALICE);
		const signal: AbortSignal = api.readAccountProfile.mock.calls[0][1].signal;
		hook.unmount();
		expect(signal.aborted).toBe(true);
	});

	it('uploads a new picture before publishing and shows the saved profile', async () => {
		api.readAccountProfile.mockResolvedValue(record(ALICE, 'alice'));
		api.uploadAvatar.mockImplementation(async (_owner, _data, _type, options) => {
			options.onPhase('signing');
			options.onPhase('uploading');
			return 'P'.repeat(43);
		});
		api.update.mockImplementation(async (_owner, _fields, options) => {
			options.onPhase('signing');
			return record(ALICE, 'renamed');
		});
		const hook = renderHook((address: string) => useAccountProfile(address), ALICE);
		await flushPromises();

		const statuses: string[] = [];
		const avatarFile = new File([new Uint8Array(3)], 'a.png', { type: 'image/png' });
		await React.act(() =>
			hook
				.current()
				.save({ displayName: 'renamed', displayNameChanged: true, avatarFile, removeAvatar: false }, (status) =>
					statuses.push(status)
				)
		);

		expect(api.uploadAvatar).toHaveBeenCalledWith(ALICE, new Uint8Array(3), 'image/png', expect.any(Object));
		expect(api.update).toHaveBeenCalledWith(
			ALICE,
			{ displayName: 'renamed', avatar: 'P'.repeat(43) },
			expect.any(Object)
		);
		expect(statuses).toEqual(['Approve picture…', 'Uploading picture…', 'Preparing profile…', 'Approve profile…']);
		expect(hook.current().summary.displayName).toBe('renamed');
		hook.unmount();
	});

	it('propagates a failed save and keeps a save that finishes after navigation off the new profile', async () => {
		api.readAccountProfile.mockImplementation(async (address: string) =>
			record(address, address === ALICE ? 'alice' : 'bob')
		);
		const hook = renderHook((address: string) => useAccountProfile(address), ALICE);
		await flushPromises();

		api.update.mockRejectedValueOnce(new Error('rejected'));
		const update = { displayName: 'x', displayNameChanged: true, avatarFile: null, removeAvatar: false };
		await expect(hook.current().save(update, () => undefined)).rejects.toThrow('rejected');
		expect(hook.current().summary.displayName).toBe('alice');

		const publish = deferred<AccountProfile>();
		api.update.mockReturnValueOnce(publish.promise);
		const save = hook.current().save(update, () => undefined);
		await flushPromises();
		hook.rerender(BOB);
		await flushPromises();
		publish.resolve(record(ALICE, 'x'));
		await React.act(() => save);
		expect(hook.current().summary).toEqual({ address: BOB, displayName: 'bob' });
		hook.unmount();
	});
});
