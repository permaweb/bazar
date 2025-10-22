import React from 'react';
import { ReactSVG } from 'react-svg';

import { readHandler } from 'api';

import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { AssetDetailType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

interface IProps {
	currentTrack: AssetDetailType | null;
	isPlaying: boolean;
	onPlayPause: () => void;
	onSkipNext: () => void;
	onSkipPrevious: () => void;
	onVolumeChange: (volume: number) => void;
	onSeek: (time: number) => void;
	onDurationChange: (duration: number) => void;
	currentTime: number;
	duration: number;
	volume: number;
	playlist: AssetDetailType[];
	currentIndex: number;
}

export default function MusicPlayer(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const audioRef = React.useRef<HTMLAudioElement | null>(null);
	const [assetMetadata, setAssetMetadata] = React.useState<any>(null);
	const [metadataLoading, setMetadataLoading] = React.useState<boolean>(false);

	React.useEffect(() => {
		if (props.currentTrack && audioRef.current) {
			audioRef.current.src = getTxEndpoint(props.currentTrack.data.id);
			if (props.isPlaying) {
				audioRef.current.play().catch(console.error);
			}
		}
	}, [props.currentTrack]);

	// Handle play/pause state changes
	React.useEffect(() => {
		if (audioRef.current && props.currentTrack) {
			if (props.isPlaying) {
				audioRef.current.play().catch(console.error);
			} else {
				audioRef.current.pause();
			}
		}
	}, [props.isPlaying]);

	React.useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = props.volume;
		}
	}, [props.volume]);

	// Handle external currentTime changes (e.g., from skip previous button)
	React.useEffect(() => {
		if (audioRef.current && Math.abs(audioRef.current.currentTime - props.currentTime) > 1) {
			// Only seek if there's a significant difference to avoid infinite loops
			audioRef.current.currentTime = props.currentTime;
		}
	}, [props.currentTime]);

	const handleTimeUpdate = () => {
		if (audioRef.current) {
			props.onSeek(audioRef.current.currentTime);
		}
	};

	const handleLoadedMetadata = () => {
		if (audioRef.current) {
			props.onSeek(0); // Reset time when new track loads
			// Update duration when metadata loads
			if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
				props.onDurationChange(audioRef.current.duration);
			}
		}
	};

	const handleEnded = () => {
		props.onSkipNext();
	};

	const formatTime = (time: number) => {
		const minutes = Math.floor(time / 60);
		const seconds = Math.floor(time % 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTime = parseFloat(e.target.value);
		if (audioRef.current) {
			audioRef.current.currentTime = newTime;
		}
		props.onSeek(newTime);
	};

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newVolume = parseFloat(e.target.value);
		props.onVolumeChange(newVolume);
	};

	async function fetchAssetMetadata(assetId: string) {
		if (metadataLoading || assetMetadata) return;
		setMetadataLoading(true);
		try {
			const processState = await readHandler({
				processId: assetId,
				action: 'Info',
				data: null,
			});
			if (processState?.Metadata) {
				setAssetMetadata(processState.Metadata);
			}
		} catch (e: any) {
			console.error('Failed to fetch asset metadata:', e);
		} finally {
			setMetadataLoading(false);
		}
	}

	// Fetch metadata when current track changes
	React.useEffect(() => {
		if (props.currentTrack?.data?.id) {
			setAssetMetadata(null); // Reset metadata for new track
			fetchAssetMetadata(props.currentTrack.data.id);
		}
	}, [props.currentTrack?.data?.id]);

	if (!props.currentTrack) {
		return null;
	}

	// Get cover art for current track - check both existing state and lazy-loaded metadata
	const coverArtId =
		props.currentTrack?.state?.metadata?.CoverArt ||
		props.currentTrack?.state?.metadata?.coverArt ||
		assetMetadata?.CoverArt ||
		assetMetadata?.coverArt;

	return (
		<S.Wrapper>
			<audio
				ref={audioRef}
				onTimeUpdate={handleTimeUpdate}
				onLoadedMetadata={handleLoadedMetadata}
				onEnded={handleEnded}
			/>

			<S.PlayerContent>
				{/* Left side - Track info and cover art */}
				<S.TrackInfo>
					<S.CoverArt>
						{coverArtId ? (
							<img
								src={getTxEndpoint(coverArtId)}
								alt="Cover Art"
								onError={(e) => {
									console.error('Failed to load cover art:', coverArtId);
									e.currentTarget.style.display = 'none';
								}}
							/>
						) : (
							<ReactSVG src={ASSETS.audio} />
						)}
						{metadataLoading && !coverArtId && (
							<S.LoadingIndicator>
								<div></div>
							</S.LoadingIndicator>
						)}
					</S.CoverArt>
					<S.TrackDetails>
						<S.TrackTitle>{props.currentTrack.data.title}</S.TrackTitle>
						<S.TrackArtist>
							{props.currentTrack.data.creator && props.currentTrack.data.creator.length > 20
								? `${props.currentTrack.data.creator.substring(0, 20)}...`
								: props.currentTrack.data.creator}
						</S.TrackArtist>
					</S.TrackDetails>
				</S.TrackInfo>

				{/* Center - Playback controls */}
				<S.PlaybackControls>
					<S.ControlButton onClick={props.onSkipPrevious}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
							<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
						</svg>
					</S.ControlButton>

					<S.PlayPauseButton onClick={props.onPlayPause}>
						<ReactSVG src={props.isPlaying ? ASSETS.pause : ASSETS.play} />
					</S.PlayPauseButton>

					<S.ControlButton onClick={props.onSkipNext}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
							<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
						</svg>
					</S.ControlButton>
				</S.PlaybackControls>

				{/* Right side - Progress and volume */}
				<S.ProgressSection>
					<S.ProgressBar>
						<input
							type="range"
							min="0"
							max={props.duration || 100}
							value={props.currentTime}
							onChange={handleSeek}
							step="0.1"
						/>
					</S.ProgressBar>

					<S.ControlsRow>
						<S.TimeDisplay>
							<span>{formatTime(props.currentTime)}</span>
							<span>{formatTime(props.duration)}</span>
						</S.TimeDisplay>

						<S.VolumeControl>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
							</svg>
							<input type="range" min="0" max="1" value={props.volume} onChange={handleVolumeChange} step="0.01" />
						</S.VolumeControl>
					</S.ControlsRow>
				</S.ProgressSection>
			</S.PlayerContent>
		</S.Wrapper>
	);
}
