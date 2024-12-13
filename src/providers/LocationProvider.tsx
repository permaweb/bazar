import React from 'react';

export interface LocationContextState {
	country: string;
	loading: boolean;
}

export interface LocationProviderProps {
	children: React.ReactNode;
}

export const LocationContext = React.createContext<LocationContextState>({
	country: null,
	loading: false,
});

export function useLocationProvider(): LocationContextState {
	return React.useContext(LocationContext);
}

export function LocationProvider(props: LocationProviderProps) {
	const [country, setCountry] = React.useState<string>(null);
	const [loading, setLoading] = React.useState<boolean>(false);

	React.useEffect(() => {
		const checkLocation = async () => {
			setLoading(true);
			try {
				const response = await fetch(`https://ipinfo.io?token=31d0ff5f3beb9f`);
				const data = await response.json();
				setCountry(data.country);
			} catch (error) {
				console.error('Error fetching location data', error.message);
			}
			setLoading(false);
		};

		checkLocation();
	}, []);

	return <LocationContext.Provider value={{ country, loading }}>{props.children}</LocationContext.Provider>;
}
