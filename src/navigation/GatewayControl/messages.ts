import { defineMessages } from 'helpers/i18n';

export const GATEWAY_CONTROL_MESSAGES = defineMessages({
	en: {
		gatewayRefreshing: 'Some assets on this page are still being refreshed on your configured AO peers.',
		gatewayPeersSummary: 'AO-Core peers, {peers}',
		gatewayPeersTooltip: 'AO-Core peers',
		gatewayLabel: 'AO Core',
		gatewayPermawebOsTitle: 'Use PermawebOS Routing',
		gatewayPermawebOsDetail: 'Use its role-aware routes and shared request state.',
		gatewayPeersLegend: 'AO-Core peers',
		gatewayPeersDescription: 'Used by Bazar when PermawebOS is unavailable or disabled above.',
		gatewayPeerLabel: 'Fallback AO-Core peer {position}',
		gatewayPeerPlaceholder: 'https://peer.example',
		gatewayPeerRemove: 'Remove fallback AO-Core peer {position}',
		gatewayPeerAdd: 'Add peer',
		gatewayPeersInvalid: 'Enter one valid HTTP or HTTPS AO-Core peer in each field.',
		gatewayApply: 'Apply settings',
		gatewayHelp:
			'The PermawebOS transport is selected by default when available. Turning it off keeps AO requests inside Bazar and uses the ordered fallback peers above.',
		gatewayHelpLabel: 'About AO transport settings',
	},
});

export type GatewayControlMessages = (typeof GATEWAY_CONTROL_MESSAGES)['en'];
