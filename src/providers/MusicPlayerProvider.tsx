import React, { createContext, useContext } from 'react';

import { AssetDetailType } from 'helpers/types';

interface MusicPlayerContextType {
	// Player state
	currentTrack: AssetDetailType | null;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	currentIndex: number;
	playlist: AssetDetailType[];

	// Player actions
	playTrack: (asset: AssetDetailType) => void;
	playPause: () => void;
	skipNext: () => void;
	skipPrevious: () => void;
	setVolume: (volume: number) => void;
	seek: (time: number) => void;
	setDuration: (duration: number) => void;
	clearPlayer: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

interface MusicPlayerProviderProps {
	children: React.ReactNode;
}

// Simple stub provider - no actual functionality
export function MusicPlayerProvider({ children }: MusicPlayerProviderProps) {
	// Stub implementation - just provides empty context
	const contextValue = React.useMemo(
		() => ({
			// Empty state
			currentTrack: null,
			isPlaying: false,
			currentTime: 0,
			duration: 0,
			volume: 0.7,
			currentIndex: 0,
			playlist: [],

			// Stub actions that do nothing
			playTrack: () => {},
			playPause: () => {},
			skipNext: () => {},
			skipPrevious: () => {},
			setVolume: () => {},
			seek: () => {},
			setDuration: () => {},
			clearPlayer: () => {},
		}),
		[]
	);

	return <MusicPlayerContext.Provider value={contextValue}>{children}</MusicPlayerContext.Provider>;
}

export function useMusicPlayer() {
	const context = useContext(MusicPlayerContext);
	if (context === undefined) {
		throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
	}
	return context;
}
