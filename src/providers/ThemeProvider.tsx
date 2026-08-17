import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';

import { resolveTheme, type ThemeName, type ThemePreference, themes } from 'helpers/theme';

const PREFERRED_THEME_KEY = 'preferredTheme';
const SYSTEM_THEME_KEY = 'isSystemTheme';

interface ThemeContextState {
	preference: ThemePreference;
	resolvedTheme: ThemeName;
	setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = React.createContext<ThemeContextState>({
	preference: 'system',
	resolvedTheme: 'light',
	setPreference: () => undefined,
});

export function useTheme(): ThemeContextState {
	return React.useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [preference, setPreferenceState] = React.useState<ThemePreference>(readThemePreference);
	const [systemPrefersDark, setSystemPrefersDark] = React.useState(readSystemPrefersDark);
	const resolvedTheme = resolveTheme(preference, systemPrefersDark);

	React.useEffect(() => {
		const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
		if (!mediaQuery) return;

		const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
		setSystemPrefersDark(mediaQuery.matches);
		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	React.useEffect(() => {
		document.documentElement.dataset.theme = resolvedTheme;
		document.documentElement.style.colorScheme = resolvedTheme === 'light' ? 'light' : 'dark';
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', themes[resolvedTheme].colors.container.primary.background);
	}, [resolvedTheme]);

	const setPreference = React.useCallback((updated: ThemePreference) => {
		setPreferenceState(updated);
		try {
			localStorage.setItem(PREFERRED_THEME_KEY, updated);
			localStorage.setItem(SYSTEM_THEME_KEY, String(updated === 'system'));
		} catch {
			// Theme selection still applies when storage is unavailable.
		}
	}, []);

	const value = React.useMemo(
		() => ({ preference, resolvedTheme, setPreference }),
		[preference, resolvedTheme, setPreference]
	);

	return (
		<ThemeContext.Provider value={value}>
			<StyledThemeProvider theme={themes[resolvedTheme]}>{children}</StyledThemeProvider>
		</ThemeContext.Provider>
	);
}

function readThemePreference(): ThemePreference {
	if (typeof window === 'undefined') return 'system';

	try {
		if (localStorage.getItem(SYSTEM_THEME_KEY) === 'true') return 'system';
		const stored = localStorage.getItem(PREFERRED_THEME_KEY);
		if (stored === 'system' || stored === 'light' || stored === 'dimmed' || stored === 'dark') return stored;
	} catch {
		// Fall through to the system preference.
	}

	return 'system';
}

function readSystemPrefersDark(): boolean {
	return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}
