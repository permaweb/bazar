import React from 'react';

import { useMusicPlayer } from 'providers/MusicPlayerProvider';

import { MusicPlayer } from '../MusicPlayer';

import * as S from './styles';

export default function GlobalMusicPlayer() {
	const musicPlayer = useMusicPlayer();

	// Don't render if no track is selected
	if (!musicPlayer.currentTrack) {
		return null;
	}

	return (
		<S.Wrapper>
			<MusicPlayer
				currentTrack={musicPlayer.currentTrack}
				isPlaying={musicPlayer.isPlaying}
				onPlayPause={musicPlayer.playPause}
				onSkipNext={musicPlayer.skipNext}
				onSkipPrevious={musicPlayer.skipPrevious}
				onVolumeChange={musicPlayer.setVolume}
				onSeek={musicPlayer.seek}
				onDurationChange={musicPlayer.setDuration}
				currentTime={musicPlayer.currentTime}
				duration={musicPlayer.duration}
				volume={musicPlayer.volume}
				playlist={musicPlayer.playlist}
				currentIndex={musicPlayer.currentIndex}
			/>
		</S.Wrapper>
	);
}
