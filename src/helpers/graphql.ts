import { getBestGatewayEndpoint } from './wayfinder';

/**
 * Gets the best GraphQL endpoint using Wayfinder
 * @returns Promise<string> - GraphQL endpoint URL
 */
export async function getGraphQLEndpoint(): Promise<string> {
	// Use the cached working gateway if available, otherwise fallback to arweave.net
	const gateway = getBestGatewayForAssets();
	const endpoint = `${gateway}/graphql`;
	console.log(`🔗 Wayfinder: Using GraphQL endpoint: ${endpoint}`);
	return endpoint;
}

/**
 * Executes a GraphQL query using the best available gateway
 * @param query - GraphQL query string
 * @param variables - Query variables
 * @returns Promise<any> - GraphQL response
 */
export async function executeGraphQLQuery(query: string, variables?: any): Promise<any> {
	try {
		const endpoint = await getGraphQLEndpoint();

		console.log(`🔍 Executing GraphQL query on: ${endpoint}`);

		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			throw new Error(`GraphQL request failed with status ${response.status}`);
		}

		const data = await response.json();

		if (data.errors) {
			console.error('❌ GraphQL errors:', data.errors);
			throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
		}

		return data;
	} catch (error) {
		console.error('❌ GraphQL query failed:', error);
		throw error;
	}
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
