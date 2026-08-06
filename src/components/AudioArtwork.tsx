import { Music2 } from 'lucide-react';

import { audioFormatLabel } from 'helpers/asset-media';

export function AudioArtwork({
  className = '',
  contentType,
  name,
}: {
  className?: string;
  contentType?: string;
  name: string;
}) {
  return (
    <span
      aria-label={`${name} ${audioFormatLabel(contentType)} audio`}
      className={`audio-artwork${className ? ` ${className}` : ''}`}
      role="img"
    >
      <Music2 aria-hidden="true" />
      <strong>Audio</strong>
      <small>{audioFormatLabel(contentType)}</small>
    </span>
  );
}
