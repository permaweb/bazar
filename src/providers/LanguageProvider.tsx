import React from 'react';

import { language } from 'helpers/language';

type LanguageType = 'en' | 'sp';

export interface LanguageContextState {
	current: LanguageType;
	setCurrent: (current: LanguageType) => void;
	object: any;
}

export interface LanguageProviderProps {
	children: React.ReactNode;
}

export const LanguageContext = React.createContext<LanguageContextState>({
	current: 'en',
	setCurrent(current: LanguageType) {
		alert(current);
	},
	object: null,
});

export function useLanguageProvider(): LanguageContextState {
	return React.useContext(LanguageContext);
}

export function LanguageProvider(props: LanguageProviderProps) {
	const [current, setCurrent] = React.useState<LanguageType>('en');

	return (
		<LanguageContext.Provider
			value={{ current, setCurrent: (current: LanguageType) => setCurrent(current), object: language }}
		>
			{props.children}
		</LanguageContext.Provider>
	);
}
