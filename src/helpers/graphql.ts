import { getBestGatewayForAssets } from './endpoints';
import { getBestGatewayEndpoint } from './wayfinder';

const debug = (..._args: any[]) => {};

function normalizeGateway(gateway: string): string {
	return gateway.endsWith('/') ? gateway.slice(0, -1) : gateway;
}

async function getGraphQLEndpointCandidates(): Promise<string[]> {
	const endpoints = new Set<string>();

	try {
		const gateway = normalizeGateway(getBestGatewayForAssets());
		endpoints.add(`${gateway}/graphql`);
	} catch (error) {
		debug('Wayfinder: Failed to derive synchronous GraphQL endpoint candidate', error);
	}

	try {
		const asyncGateway = normalizeGateway(await getBestGatewayEndpoint());
		endpoints.add(`${asyncGateway}/graphql`);
	} catch (error) {
		debug('Wayfinder: Failed to derive async GraphQL endpoint candidate', error);
	}

	endpoints.add('https://arweave.net/graphql');
	endpoints.add('https://arweave-search.goldsky.com/graphql');
	endpoints.add('https://g8way.io/graphql');

	return Array.from(endpoints);
}

/**
 * Gets the best GraphQL endpoint using Wayfinder
 * @returns Promise<string> - GraphQL endpoint URL
 */
export async function getGraphQLEndpoint(): Promise<string> {
	const candidates = await getGraphQLEndpointCandidates();
	const endpoint = candidates[0] ?? 'https://arweave.net/graphql';
	debug('Wayfinder: Using GraphQL endpoint:', endpoint);
	return endpoint;
}

/**
 * Executes a GraphQL query using the best available gateway
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @returns Promise<any> - GraphQL response
 */
export async function executeGraphQLQuery(query: string, variables?: any): Promise<any> {
	const endpoints = await getGraphQLEndpointCandidates();
	const errors: { endpoint: string; error: any }[] = [];

	for (const endpoint of endpoints) {
		try {
			debug('Executing GraphQL query on:', endpoint);
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query, variables }),
			});

			const responseText = await response.text();

			if (!response.ok) {
				const preview = responseText ? responseText.slice(0, 200) : '';
				const errorMessage = preview
					? `HTTP ${response.status}: ${preview}`
					: `HTTP ${response.status}: ${response.statusText}`;
				errors.push({ endpoint, error: errorMessage });
				continue;
			}

			let data: any;
			try {
				data = JSON.parse(responseText);
			} catch (parseError) {
				const preview = responseText ? responseText.slice(0, 200) : '';
				const errorMessage = preview ? `Invalid JSON response: ${preview}` : 'Invalid JSON response with empty body';
				errors.push({ endpoint, error: new Error(errorMessage) });
				continue;
			}

			if (data.errors) {
				const graphQLError = new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
				errors.push({ endpoint, error: graphQLError });
				continue;
			}

			return data;
		} catch (error) {
			errors.push({ endpoint, error });
		}
	}

	const error = new Error(`GraphQL request failed on endpoints: ${endpoints.join(', ')}`);
	(error as any).details = errors;
	console.error('❌ GraphQL query failed across all endpoints:', errors);
	throw error;
}

/**
 * Executes a GraphQL query with retry logic
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise<any> - GraphQL response
 */
export async function executeGraphQLQueryWithRetry(
	query: string,
	variables?: any,
	maxRetries: number = 3
): Promise<any> {
	let lastError: any;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await executeGraphQLQuery(query, variables);
		} catch (error) {
			lastError = error;
			console.warn(`⚠️ GraphQL attempt ${attempt}/${maxRetries} failed:`, error);

			if (attempt < maxRetries) {
				// Wait before retrying (exponential backoff)
				await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
			}
		}
	}

	throw lastError;
}

/**
 * Gets a GraphQL endpoint for a specific gateway (for backward compatibility)
 * @param gateway - Gateway host (e.g., 'arweave.net')
 * @returns string - GraphQL endpoint URL
 */
export function getGraphQLEndpointForGateway(gateway: string): string {
	return `https://${gateway}/graphql`;
}
