import {
	connect as originalConnect,
	createDataItemSigner as originalCreateDataItemSigner,
	createSigner as originalCreateSigner,
	dryrun as originalDryrun,
	message as originalMessage,
	result as originalResult,
	results as originalResults,
} from '@permaweb/aoconnect';

import { getAOConfig } from './config';

// Get the current AO configuration (with user overrides if available)
const getAOConnectConfig = () => {
	const config = getAOConfig();
	return {
		MU_URL: config.mu_url,
		CU_URL: config.cu_url,
		GATEWAY_URL: config.gateway,
	};
};

// Export custom functions that use the user's configuration
export const createDataItemSigner = originalCreateDataItemSigner;
export const createSigner = originalCreateSigner;

export const dryrun = (args: any) => {
	const config = getAOConnectConfig();
	return originalDryrun({
		...args,
		CU_URL: config.CU_URL,
	});
};

export const message = (args: any) => {
	const config = getAOConnectConfig();
	return originalMessage({
		...args,
		MU_URL: config.MU_URL,
	});
};

export const result = (args: any) => {
	const config = getAOConnectConfig();
	return originalResult({
		...args,
		CU_URL: config.CU_URL,
	});
};

export const results = (args: any) => {
	const config = getAOConnectConfig();
	return originalResults({
		...args,
		CU_URL: config.CU_URL,
	});
};

export const connect = (args?: any) => {
	const config = getAOConnectConfig();
	// Support switching between mainnet and legacy via VITE_AO env var
	// Default to mainnet for this branch
	const aoMode = import.meta.env.VITE_AO || 'mainnet';
	const defaultMode = aoMode === 'mainnet' ? 'mainnet' : 'legacy';

	// If args already specifies MODE, use that; otherwise use the default from VITE_AO
	const mode = args?.MODE || defaultMode;

	// Log mode when connecting (only if not already specified in args to avoid duplicate logs)
	if (!args?.MODE && mode === 'mainnet') {
		console.log('🔗 AO Connect: Using MAINNET mode');
		console.log('   CU_URL:', config.CU_URL);
		console.log('   MU_URL:', config.MU_URL);
		console.log('   GATEWAY_URL:', config.GATEWAY_URL);
	} else if (!args?.MODE && mode === 'legacy') {
		console.log('🔗 AO Connect: Using LEGACY mode');
	}

	// When MODE is 'mainnet', @permaweb/aoconnect should handle CU/MU URLs automatically
	// Only pass them explicitly if in legacy mode or if explicitly provided in args
	const connectConfig: any = {
		MODE: mode,
		GATEWAY_URL: config.GATEWAY_URL,
	};

	// Extract CU_URL and MU_URL from args if present (before spreading args)
	const explicitCU = args?.CU_URL;
	const explicitMU = args?.MU_URL;

	// Only pass CU_URL and MU_URL if:
	// 1. We're in legacy mode (need explicit testnet URLs), OR
	// 2. They're explicitly provided in args (user override)
	if (mode === 'legacy') {
		// In legacy mode, use explicit testnet URLs
		connectConfig.CU_URL = explicitCU || config.CU_URL;
		connectConfig.MU_URL = explicitMU || config.MU_URL;
	} else if (explicitCU || explicitMU) {
		// In mainnet mode, only use CU/MU URLs if explicitly provided in args
		if (explicitCU) connectConfig.CU_URL = explicitCU;
		if (explicitMU) connectConfig.MU_URL = explicitMU;
	}
	// For mainnet mode without explicit CU/MU in args, don't pass them - let aoconnect handle automatically

	// Apply all other args (excluding CU_URL/MU_URL which we've handled above)
	const { CU_URL, MU_URL, ...otherArgs } = args || {};
	Object.assign(connectConfig, otherArgs);

	return originalConnect(connectConfig);
};

// Also export the original functions in case they're needed
export const aoconnect = {
	createDataItemSigner: originalCreateDataItemSigner,
	createSigner: originalCreateSigner,
	dryrun: originalDryrun,
	message: originalMessage,
	result: originalResult,
	results: originalResults,
	connect: originalConnect,
};

// Export a function to get current AO URLs for debugging/display
export const getCurrentAOUrls = () => {
	return getAOConnectConfig();
};
