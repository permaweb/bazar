import React from 'react';
import { Pause, Play } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { RangeInput } from 'components/atoms/RangeInput';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { useAudioWaveformPlayer } from '../../../hooks/useAudioWaveformPlayer';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { audioTimelineKeyTarget, formatAudioTime } from '../../../model/audio-waveform';

export default function AudioWaveformPlayer(props: { name: string; src: string }) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const player = useAudioWaveformPlayer(props.src);
	const draggingRef = React.useRef(false);

	const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!player.duration) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		if (!bounds.width) return;
		player.seek(((event.clientX - bounds.left) / bounds.width) * player.duration);
	};
	const seekFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!player.duration) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		if (!bounds.width) return;
		player.seek(((event.clientX - bounds.left) / bounds.width) * player.duration);
	};

	return (
		<div className="audio-waveform-player">
			<audio
				aria-hidden="true"
				{...player.mediaEvents}
				preload="metadata"
				ref={player.audioRef}
				src={props.src}
			/>
			<Button
				aria-label={formatMessage(messages.audioControlLabel, {
					action: player.playing ? messages.audioPause : messages.audioPlay,
					name: props.name,
				})}
				className="audio-waveform-play"
				onClick={player.togglePlayback}
				size="custom"
			>
				{player.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
			</Button>
			<div className="audio-waveform-main">
				<div className="audio-waveform-meta">
					<span>
						{formatAudioTime(player.currentTime)} / {formatAudioTime(player.duration)}
					</span>
					<small aria-live="polite">
						{player.status === 'idle'
							? messages.audioStatusIdle
							: player.status === 'loading'
							? messages.audioStatusLoading
							: player.status === 'unavailable'
							? messages.audioStatusUnavailable
							: messages.audioStatusReady}
					</small>
				</div>
				<div className="audio-waveform-viewport">
					<div
						className="audio-waveform-track"
						onClick={seekFromClick}
						onPointerDown={(event) => {
							if (!player.duration) return;
							draggingRef.current = true;
							event.currentTarget.setPointerCapture(event.pointerId);
							seekFromPointer(event);
						}}
						onPointerMove={(event) => {
							if (draggingRef.current) seekFromPointer(event);
						}}
						onPointerUp={(event) => {
							draggingRef.current = false;
							if (event.currentTarget.hasPointerCapture(event.pointerId)) {
								event.currentTarget.releasePointerCapture(event.pointerId);
							}
						}}
					>
						{player.status === 'ready' ? (
							<>
								<div aria-hidden="true" className="audio-waveform-bars">
									{player.peaks.map((peak, index) => (
										<i key={index} style={{ height: `${Math.round(peak * 100)}%` }} />
									))}
								</div>
								<div
									aria-hidden="true"
									className="audio-waveform-bars is-played"
									style={{ clipPath: `inset(0 ${Math.max(0, (1 - player.progress) * 100)}% 0 0)` }}
								>
									{player.peaks.map((peak, index) => (
										<i key={index} style={{ height: `${Math.round(peak * 100)}%` }} />
									))}
								</div>
							</>
						) : (
							<div aria-hidden="true" className={`audio-waveform-placeholder is-${player.status}`} />
						)}
						<span
							aria-hidden="true"
							className="audio-waveform-playhead"
							style={{ left: `${player.progress * 100}%` }}
						/>
						<RangeInput
							aria-label={formatMessage(messages.audioTimelineLabel, { name: props.name })}
							aria-valuetext={formatMessage(messages.audioTimelineValue, {
								current: formatAudioTime(player.currentTime),
								duration: formatAudioTime(player.duration),
							})}
							className="audio-waveform-range"
							disabled={!player.duration}
							max={player.duration || 1}
							min={0}
							onChange={(event) => player.seek(Number(event.target.value))}
							onMouseDown={(event) => {
								const bounds = event.currentTarget.getBoundingClientRect();
								if (bounds.width) {
									player.seek(((event.clientX - bounds.left) / bounds.width) * player.duration);
								}
							}}
							onKeyDown={(event) => {
								const next = audioTimelineKeyTarget({
									key: event.key,
									shiftKey: event.shiftKey,
									currentTime: player.currentTime,
									duration: player.duration,
								});
								if (next === undefined) return;
								event.preventDefault();
								player.seek(next);
							}}
							step="0.01"
							value={Math.min(player.currentTime, player.duration || 1)}
						/>
						<div aria-hidden="true" className="audio-waveform-ticks">
							{player.ticks.map((tick) => (
								<span key={tick} style={{ left: `${(tick / player.duration) * 100}%` }}>
									{formatAudioTime(tick)}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
