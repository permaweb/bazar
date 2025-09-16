import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { AOCONFIG } from 'helpers/config';

export interface AOSettings {
	cu_url: string;
	mu_url: string;
	gateway: string;
	hb_node: string;
}

interface AOSettingsContextType {
	settings: AOSettings;
	updateSettings: (newSettings: Partial<AOSettings>) => void;
	resetToDefaults: () => void;
	isUsingDefaults: boolean;
}

const AOSettingsContext = createContext<AOSettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'ao_settings';

export function AOSettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState<AOSettings>(AOCONFIG);
	const [isUsingDefaults, setIsUsingDefaults] = useState(true);

	// Load settings from localStorage on mount
	useEffect(() => {
		const savedSettings = localStorage.getItem(STORAGE_KEY);
		if (savedSettings) {
			try {
				const parsed = JSON.parse(savedSettings);
				setSettings({ ...AOCONFIG, ...parsed });
				setIsUsingDefaults(false);
			} catch (error) {
				console.error('Failed to parse saved AO settings:', error);
			}
		}
	}, []);

	const updateSettings = (newSettings: Partial<AOSettings>) => {
		const updatedSettings = { ...settings, ...newSettings };
		setSettings(updatedSettings);

		// Save to localStorage
		localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
		setIsUsingDefaults(false);
	};

	const resetToDefaults = () => {
		setSettings(AOCONFIG);
		localStorage.removeItem(STORAGE_KEY);
		setIsUsingDefaults(true);
	};

	return (
		<AOSettingsContext.Provider
			value={{
				settings,
				updateSettings,
				resetToDefaults,
				isUsingDefaults,
			}}
		>
			{children}
		</AOSettingsContext.Provider>
	);
}

export function useAOSettings() {
	const context = useContext(AOSettingsContext);
	if (context === undefined) {
		throw new Error('useAOSettings must be used within an AOSettingsProvider');
	}
	return context;
}
