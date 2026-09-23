// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AO_TRANSPORT_QUERY_PARAMETER, BAZAR_AO_TRANSPORT, fallbackAoPeersFromLocation } from 'helpers/config';
import { type AoPeerSettings, aoPeerSettingsUrl, useAoPeerSettings } from 'hooks/useAoPeerSettings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = { href: 'https://bazar.example/?node=https%3A%2F%2Fpeer.example', protocol: 'https:' };

describe('AO peer settings URL', () => {
	it('keeps one entry per field and applies the Bazar transport by default', () => {
		const url = aoPeerSettingsUrl(page, ['https://one.example', 'https://two.example'], false);

		expect(url?.searchParams.get('node')).toBe('https://one.example,https://two.example');
		expect(url?.searchParams.get(AO_TRANSPORT_QUERY_PARAMETER)).toBe(BAZAR_AO_TRANSPORT);
	});

	it('drops the transport parameter when PermawebOS routing is selected', () => {
		const url = aoPeerSettingsUrl(
			{
				href: `https://bazar.example/?${AO_TRANSPORT_QUERY_PARAMETER}=${BAZAR_AO_TRANSPORT}`,
				protocol: 'https:',
			},
			['https://one.example'],
			true
		);

		expect(url?.searchParams.has(AO_TRANSPORT_QUERY_PARAMETER)).toBe(false);
		expect(url?.searchParams.get('node')).toBe('https://one.example');
	});

	it('collapses duplicates and rejects empty, multiple, or invalid peers', () => {
		expect(
			aoPeerSettingsUrl(page, ['https://one.example', 'https://one.example'], false)?.searchParams.get('node')
		).toBe('https://one.example');
		expect(aoPeerSettingsUrl(page, [], false)).toBeNull();
		expect(aoPeerSettingsUrl(page, [''], false)).toBeNull();
		expect(aoPeerSettingsUrl(page, ['https://one.example', ''], false)).toBeNull();
		expect(aoPeerSettingsUrl(page, ['https://one.example,https://two.example'], false)).toBeNull();
		expect(aoPeerSettingsUrl(page, ['ftp://one.example'], false)).toBeNull();
	});
});

let root: Root;
let settings: AoPeerSettings | undefined;

function Probe() {
	settings = useAoPeerSettings();
	return null;
}

function current(): AoPeerSettings {
	if (!settings) throw new Error('hook-not-rendered');
	return settings;
}

describe('useAoPeerSettings', () => {
	beforeEach(() => {
		root = createRoot(document.createElement('div'));
		settings = undefined;
		React.act(() => root.render(<Probe />));
	});

	afterEach(() => {
		React.act(() => root.unmount());
	});

	it('starts from the peers the page is already routing through', () => {
		const fallbackPeers = fallbackAoPeersFromLocation(window.location);
		expect(current().peers).toEqual(fallbackPeers.length ? fallbackPeers : ['']);
		expect(current().activePeers.length).toBeGreaterThan(0);
		expect(current().peersInvalid).toBe(false);
	});

	it('marks an incomplete peer field on apply and clears that state on the next edit', () => {
		React.act(() => current().addPeer());
		React.act(() => current().apply());
		expect(current().peersInvalid).toBe(true);

		React.act(() => current().updatePeer(current().peers.length - 1, 'https://peer.example'));
		expect(current().peers.at(-1)).toBe('https://peer.example');
		expect(current().peersInvalid).toBe(false);
	});

	it('adds and removes fallback peer fields', () => {
		const initial = current().peers.length;
		React.act(() => current().addPeer());
		expect(current().peers).toHaveLength(initial + 1);

		React.act(() => current().updatePeer(initial, 'https://second.example'));
		React.act(() => current().removePeer(0));
		expect(current().peers).toHaveLength(initial);
		expect(current().peers.at(-1)).toBe('https://second.example');
	});

	it('toggles PermawebOS routing without touching the peer fields', () => {
		const peers = current().peers;
		React.act(() => current().togglePermawebOs());

		expect(current().usesPermawebOs).toBe(true);
		expect(current().peers).toEqual(peers);
	});
});
