import React from 'react';

import { normalizeServingNodeOrigins } from 'api/marketplace';

import {
	AO_TRANSPORT_QUERY_PARAMETER,
	BAZAR_AO_TRANSPORT,
	fallbackAoPeersFromLocation,
	gatewaysFromLocation,
	permawebOsAoAvailable,
	usesPermawebOsAo,
} from 'helpers/config';

export type AoPeerSettings = {
	/** The editable fallback peer fields, in priority order. */
	peers: string[];
	/** PermawebOS routing is selected; it applies only while PermawebOS is available. */
	usesPermawebOs: boolean;
	permawebOsAvailable: boolean;
	/** The peers the page currently routes AO requests through. */
	activePeers: string[];
	/** The last apply found a field that is not exactly one valid HTTP or HTTPS peer. */
	peersInvalid: boolean;
	updatePeer(index: number, value: string): void;
	addPeer(): void;
	removePeer(index: number): void;
	togglePermawebOs(): void;
	/** Reloads the page with the edited transport settings, or marks the peers invalid. */
	apply(): void;
};

/** Edits the AO-Core transport settings that the page reads from its URL. */
export function useAoPeerSettings(): AoPeerSettings {
	const permawebOsAvailable = permawebOsAoAvailable();
	const fallbackPeers = fallbackAoPeersFromLocation(window.location);
	const [peers, setPeers] = React.useState(() => (fallbackPeers.length ? fallbackPeers : ['']));
	const [usesPermawebOs, setUsesPermawebOs] = React.useState(() => usesPermawebOsAo(window.location));
	const [peersInvalid, setPeersInvalid] = React.useState(false);

	const updatePeer = React.useCallback((index: number, value: string) => {
		setPeers((current) => current.map((peer, peerIndex) => (peerIndex === index ? value : peer)));
		setPeersInvalid(false);
	}, []);
	const addPeer = React.useCallback(() => {
		setPeers((current) => [...current, '']);
		setPeersInvalid(false);
	}, []);
	const removePeer = React.useCallback((index: number) => {
		setPeers((current) => current.filter((_, peerIndex) => peerIndex !== index));
		setPeersInvalid(false);
	}, []);
	const togglePermawebOs = React.useCallback(() => setUsesPermawebOs((current) => !current), []);
	const apply = () => {
		const url = aoPeerSettingsUrl(window.location, peers, permawebOsAvailable && usesPermawebOs);
		if (!url) {
			setPeersInvalid(true);
			return;
		}
		setPeersInvalid(false);
		window.location.assign(url);
	};

	return {
		peers,
		usesPermawebOs,
		permawebOsAvailable,
		activePeers: usesPermawebOs && permawebOsAvailable ? gatewaysFromLocation(window.location) : fallbackPeers,
		peersInvalid,
		updatePeer,
		addPeer,
		removePeer,
		togglePermawebOs,
		apply,
	};
}

/**
 * The current page URL with `peers` as its ordered AO-Core peers and the chosen transport, or `null` unless every
 * field holds exactly one valid HTTP or HTTPS peer. Duplicate peers collapse to their first position.
 */
export function aoPeerSettingsUrl(
	location: Pick<Location, 'href' | 'protocol'>,
	peers: string[],
	usePermawebOsTransport: boolean
): URL | null {
	const parsedPeers = peers.map((value) => normalizeServingNodeOrigins(value, location.protocol));
	const computeOrigins =
		parsedPeers.every((origins) => origins?.length === 1) && parsedPeers.length
			? [...new Set(parsedPeers.flatMap((origins) => origins ?? []))]
			: null;
	if (!computeOrigins) return null;
	const url = new URL(location.href);
	url.searchParams.set('node', computeOrigins.join(','));
	if (usePermawebOsTransport) {
		url.searchParams.delete(AO_TRANSPORT_QUERY_PARAMETER);
	} else {
		url.searchParams.set(AO_TRANSPORT_QUERY_PARAMETER, BAZAR_AO_TRANSPORT);
	}
	return url;
}
