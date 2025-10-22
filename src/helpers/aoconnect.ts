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
	return originalConnect({
		MODE: 'mainnet',
		MU_URL: config.MU_URL,
		CU_URL: config.CU_URL,
		GATEWAY_URL: config.GATEWAY_URL,
		...args,
	});
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
