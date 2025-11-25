import React from 'react';
import { ThemeProvider } from 'styled-components';

import { darkTheme, lightTheme, theme } from 'helpers/themes';

type ThemeType = 'light' | 'dark';

interface CustomThemeContextState {
	current: ThemeType;
	setCurrent: (updated: ThemeType) => void;
}

interface CustomThemeProviderProps {
	children: React.ReactNode;
}

const CustomThemeContext = React.createContext<CustomThemeContextState>({
	current: 'light',
	setCurrent(updated: ThemeType) {
		alert(updated);
	},
});

export function useCustomThemeProvider(): CustomThemeContextState {
	return React.useContext(CustomThemeContext);
}

export function CustomThemeProvider(props: CustomThemeProviderProps) {
	const storagePreferredTheme = localStorage.getItem('preferredTheme');
	const preferredTheme =
		window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

	const [current, setCurrent] = React.useState<ThemeType>(
		(storagePreferredTheme ? storagePreferredTheme : preferredTheme) as ThemeType
	);

	React.useEffect(() => {
		if (storagePreferredTheme) {
			setCurrent(storagePreferredTheme as ThemeType);
		} else {
			localStorage.setItem('preferredTheme', preferredTheme);
			setCurrent(preferredTheme);
		}
	}, []);

	function handleSetCurrent(updated: ThemeType) {
		localStorage.setItem('preferredTheme', updated);
		setCurrent(updated);
	}

	function getTheme() {
		let themeObject: any;
		const themeType = current || 'light';
		switch (themeType) {
			case 'light':
				themeObject = lightTheme;
				break;
			case 'dark':
				themeObject = darkTheme;
				break;
			default:
				themeObject = lightTheme;
				break;
		}
		return theme(themeObject);
	}

	return (
		<CustomThemeContext.Provider
			value={{ current: current, setCurrent: (updated: ThemeType) => handleSetCurrent(updated) }}
		>
			<ThemeProvider theme={getTheme()}>{props.children}</ThemeProvider>
		</CustomThemeContext.Provider>
	);
}
