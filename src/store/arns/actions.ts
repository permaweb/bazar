export const hydrateARNS = (payload) => ({
	type: 'ARNS/HYDRATE',
	payload,
});

export const fetchARNSStart = () => ({
	type: 'ARNS/FETCH_START',
});

export const fetchARNSSuccess = (payload) => ({
	type: 'ARNS/FETCH_SUCCESS',
	payload,
});

export const fetchARNSFailure = (error) => ({
	type: 'ARNS/FETCH_FAILURE',
	payload: error,
});
